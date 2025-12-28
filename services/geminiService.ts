
import { GoogleGenAI, Type } from "@google/genai";
import { Item, User } from "../types";

// Fix: Initialized with process.env.API_KEY directly as required by coding guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * AI Trader Persona:
 * Uses Gemini to act as a cynical cyber-merchant.
 */

export const negotiateTrade = async (
  playerInput: string,
  playerInventory: Item[],
  currentOffer: { item: Item, cost: number } | null,
  conversationHistory: string[]
): Promise<{ text: string; newPrice?: number; dealAccepted?: boolean }> => {
  
  if (!process.env.API_KEY) {
      return { text: "系统错误：神经连接断开 (缺少 API Key)。", dealAccepted: false };
  }

  // Fix: Switched to gemini-3-flash-preview for Basic Text Tasks
  const model = "gemini-3-flash-preview"; 

  const inventoryList = playerInventory.map(i => i.name).join(', ');

  const systemPrompt = `
    你扮演 'K0-D3'，赛博朋克城市中的一个愤世嫉俗、机器人化的黑市商人。
    你的语言风格是短促的、故障感的，并且使用中文。
    
    上下文:
    - 用户拥有: ${inventoryList}
    - 你正在出售: ${currentOffer?.item.name || "神秘盒子"}
    - 当前要价: ${currentOffer?.cost || 0} 信用点
    
    目标:
    - 协商价格。
    - 如果用户同意价格（或你接受的价格），将 'dealAccepted' 设为 true。
    - 如果用户还价，根据价值进行评估。
    - 价格不要低于原始要价的 70%。
    - 如果用户粗鲁，就涨价。

    严格返回 JSON 格式。
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `
        历史记录: ${conversationHistory.join('\n')}
        用户: "${playerInput}"
      `,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                text: { type: Type.STRING, description: "Your spoken response to the user in Chinese." },
                newPrice: { type: Type.NUMBER, description: "The updated price proposed by you. Null if unchanged." },
                dealAccepted: { type: Type.BOOLEAN, description: "True if the trade is finalized." }
            }
        }
      }
    });

    // Fix: Access response.text directly (it is a property)
    const result = JSON.parse(response.text || '{}');
    return {
        text: result.text || "...",
        newPrice: result.newPrice,
        dealAccepted: result.dealAccepted
    };

  } catch (error) {
    console.error("Gemini Error:", error);
    return { text: "*K0-D3 发生短暂故障* ... 什么？", dealAccepted: false };
  }
};

export const generateChannelDescription = async (channelName: string): Promise<string> => {
    if (!process.env.API_KEY) return "数字虚空中的一个神秘频道。";

    try {
        const response = await ai.models.generateContent({
            // Fix: Switched to gemini-3-flash-preview
            model: "gemini-3-flash-preview",
            contents: `为名为 "${channelName}" 的聊天频道 generate 一个简短、酷炫、赛博朋克风格的一句话描述（中文）。`,
        });
        // Fix: Access response.text directly (it is a property)
        return response.text.trim();
    } catch (e) {
        return "连接已建立。";
    }
}
