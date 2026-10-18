import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  initiateAlatPayTransaction,
  verifyAlatPayWebhookSignature,
  getAlatPayConfig,
} from './src/lib/alatpay.ts';
import { calculateLandingCost } from './src/lib/cost-matrix.ts';

dotenv.config();

const PORT = 3000;

function getAiClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Idempotency store for ALATPay webhook references
const processedWebhookReferences = new Set<string>();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // 1. ALATPay by Wema Transaction Initiation
  app.post('/api/alatpay/initiate', (req, res) => {
    try {
      const { userId, email, fullName, amount, currency, channel, purpose, lotId } = req.body;
      if (!userId || !amount || amount <= 0) {
        res.status(400).json({ error: 'Valid userId and positive amount are required.' });
        return;
      }

      const tx = initiateAlatPayTransaction({
        userId: String(userId),
        email: String(email || 'client@eyinvestment.com'),
        fullName: String(fullName || 'Smart Ride Executive Client'),
        amount: Number(amount),
        currency: currency === 'USD' ? 'USD' : 'NGN',
        channel: channel || 'WEMA_VIRTUAL_ACCOUNT',
        purpose: purpose || 'BIDDING_DEPOSIT',
        lotId: lotId ? String(lotId) : undefined,
      });

      res.json(tx);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to initiate ALATPay transaction' });
    }
  });

  // 2. ALATPay by Wema Webhook Handler (HMAC-SHA512 verification + idempotency)
  app.post('/api/alatpay/webhook', (req, res) => {
    try {
      const signature = String(req.headers['x-alatpay-signature'] || '');
      const { reference, userId, amount, currency, purpose, lotId } = req.body;

      if (!reference || !userId || !amount) {
        res.status(400).json({ error: 'Missing required ALATPay webhook fields' });
        return;
      }

      if (processedWebhookReferences.has(reference)) {
        res.json({
          status: 'IDEMPOTENT_ALREADY_PROCESSED',
          reference,
          verified: true,
        });
        return;
      }

      const payloadForSigning = JSON.stringify({
        reference,
        userId,
        amount: Math.max(1, Math.round(Number(amount) || 0)),
        currency,
        purpose,
        lotId: lotId || null,
      });

      const config = getAlatPayConfig();
      const isValid = verifyAlatPayWebhookSignature(
        payloadForSigning,
        signature,
        config.secretKey
      );

      if (!isValid) {
        res.status(401).json({ error: 'Invalid ALATPay webhook signature' });
        return;
      }

      processedWebhookReferences.add(reference);
      res.json({
        status: 'VERIFIED_AND_CREDITED',
        reference,
        verified: true,
        creditedAmount: Number(amount),
        currency,
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Webhook processing error' });
    }
  });

  // 3. Deterministic Landing Cost Calculator Endpoint
  app.post('/api/calculator', (req, res) => {
    try {
      const breakdown = calculateLandingCost({
        purchasePriceUsd: Number(req.body.purchasePriceUsd) || 18500,
        departurePort: req.body.departurePort || 'Newark, NJ',
        shippingMethod: req.body.shippingMethod || 'RORO',
        destinationPort: req.body.destinationPort || 'Tin Can Island, Lagos',
        vehicleAgeYears: Number(req.body.vehicleAgeYears) || 4,
        exchangeRateNgnPerUsd: Number(req.body.exchangeRateNgnPerUsd) || 1600,
      });
      res.json(breakdown);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Calculation error' });
    }
  });

  // 4. Multi-Turn Gemini Chatbot & Voice Intent Parser
  // Supports gemini-4-argon (with ThinkingLevel.HIGH), gemini-3.8-flash, and gemini-3.1-flash-lite
  app.post('/api/ai-agent/chat', async (req, res) => {
    try {
      const {
        messages,
        mode = 'general',
        budgetContext,
        inventorySummary,
      } = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'Messages array is required.' });
        return;
      }

      const ai = getAiClient();

      // Select model according to user requirements:
      // - 'complex' / 'thinking' -> gemini-4-argon with ThinkingLevel.HIGH (no maxOutputTokens)
      // - 'fast' -> gemini-3.1-flash-lite
      // - 'general' -> gemini-3.8-flash
      let selectedModel = 'gemini-3.8-flash';
      if (mode === 'thinking' || mode === 'complex') {
        selectedModel = 'gemini-4-argon';
      } else if (mode === 'fast') {
        selectedModel = 'gemini-3.1-flash-lite';
      }

      const systemInstruction = `You are the Executive Financial & Automotive Acquisition Copilot for Smart Ride (owned by E-Y Investment Limited, RC-1894022, Lagos, Nigeria).
Strict Brand Rules:
1. NEVER mention any external salvage or auction platform names (never mention Copart, IAAI, Manheim, or Adesa). All vehicles are exclusively "Smart Ride US Direct Inventory" or "Smart Ride Verified Stock".
2. All payments, virtual accounts, and corporate USD domiciliary settlements route exclusively through Wema Bank / ALATPay.
3. You help the user track their NGN (₦) and USD ($) budgets, analyze synced Wema Bank transactions, calculate US-to-Nigeria landed vehicle costs (towing + RoRo/Container ocean freight + Nigeria Customs duty + E-Y fee), recommend vehicles from inventory, book Live Virtual Yard Inspections, and evaluate Bioscience & Clean-Fuel asset molecules.

Current User Budget & Wallet Context:
${JSON.stringify(budgetContext || {})}

Available Smart Ride Verified Inventory:
${JSON.stringify(inventorySummary || [])}

Provide concise, actionable, executive-grade financial and automotive advice. If the user asks to find a vehicle within a Naira or USD budget or book a Live Virtual Yard Inspection, include structured recommendations in your response.`;

      const contents = messages.map((m: { role: string; text: string }) => ({
        role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.text || '') }],
      }));

      const config: Record<string, any> = {
        systemInstruction,
      };

      if (selectedModel === 'gemini-4-argon') {
        config.thinkingConfig = {
          thinkingLevel: ThinkingLevel.HIGH,
        };
        // CRITICAL: Do NOT set maxOutputTokens when using ThinkingLevel.HIGH
      }

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents,
        config,
      });

      res.json({
        reply: response.text || 'I have analyzed your budget and Smart Ride US Direct stock.',
        modelUsed: selectedModel,
        thinkingMode: selectedModel === 'gemini-4-argon' ? 'HIGH' : 'STANDARD',
      });
    } catch (error: any) {
      console.error('Gemini chat error:', error);
      res.status(500).json({
        error: error?.message || 'Failed to generate response from Gemini API.',
      });
    }
  });

  // 5. Voice Intent Parsing Endpoint (for natural speech-to-intent search & inspection booking)
  app.post('/api/ai-agent/parse-intent', async (req, res) => {
    try {
      const { transcript } = req.body;
      if (!transcript) {
        res.status(400).json({ error: 'Transcript is required' });
        return;
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `Parse this client voice request for Smart Ride (E-Y Investment Limited): "${transcript}".
Extract maximum budget in NGN or USD, preferred vehicle make/model/year, whether they want to book a virtual inspection, and a short spoken confirmation reply (never mention external auctions).`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intentType: {
                type: Type.STRING,
                description: 'SEARCH_INVENTORY, BOOK_INSPECTION, or BUDGET_QUERY',
              },
              maxBudgetNgn: {
                type: Type.NUMBER,
                description: 'Extracted Naira budget if mentioned, else 0',
              },
              searchMakeOrModel: {
                type: Type.STRING,
                description: 'Make or model keyword such as Lexus, Mercedes, Toyota, Porsche, or empty string',
              },
              conditionFilter: {
                type: Type.STRING,
                description: 'RUN_AND_DRIVE or ALL',
              },
              spokenSummary: {
                type: Type.STRING,
                description: 'Natural 1-2 sentence executive voice response summarizing the action taken.',
              },
            },
            required: ['intentType', 'maxBudgetNgn', 'searchMakeOrModel', 'conditionFilter', 'spokenSummary'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      res.json(parsed);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Voice intent parsing failed' });
    }
  });

  // 6. Text-to-Speech Endpoint using model gemini-3.8-flash-tts (MANDATORY requirement)
  app.post('/api/ai-agent/tts', async (req, res) => {
    try {
      const { text, voiceName = 'Kore' } = req.body;
      if (!text || typeof text !== 'string') {
        res.status(400).json({ error: 'Text is required for speech synthesis.' });
        return;
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: text.slice(0, 900),
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      const mimeType =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || 'audio/wav';

      if (!base64Audio) {
        res.status(500).json({ error: 'No audio returned from gemini-3.8-flash-tts' });
        return;
      }

      res.json({
        audioBase64: base64Audio,
        mimeType,
        model: 'gemini-3.8-flash-tts',
      });
    } catch (error: any) {
      console.error('TTS error:', error);
      res.status(500).json({
        error: error?.message || 'Speech synthesis failed.',
      });
    }
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Ride (E-Y Investment Limited) server running on http://localhost:${PORT}`);
  });
}

startServer();
