
import { GoogleGenAI, Type } from "@google/genai";
import type { UploadedFile, GeminiResponse } from '../types.ts';

const getFilePart = async (file: UploadedFile) => {
  return {
    inlineData: {
      mimeType: file.type,
      data: file.base64,
    },
  };
};

const getPrompt = () => {
  return `
    Bạn là chuyên gia soạn thảo văn bản hành chính theo Nghị định 30/2020/NĐ-CP.
    Nhiệm vụ:
    1. Phân tích văn bản đầu vào, sửa lỗi chính tả và định dạng nội dung cho trang trọng, đúng quy chuẩn.
    2. TRÍCH XUẤT cấu trúc văn bản thành các thành phần riêng biệt (Header, Body, Footer) để phục vụ việc in ấn bố cục 2 cột (Quốc hiệu/Tên cơ quan).
       - Nếu văn bản thiếu thông tin (ví dụ thiếu Quốc hiệu, Tiêu ngữ), hãy tự động bổ sung cho đúng chuẩn Nghị định 30.
       - Tên cơ quan chủ quản và tên cơ quan ban hành phải viết hoa đúng quy định.
       - Quốc hiệu: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM". Tiêu ngữ: "Độc lập - Tự do - Hạnh phúc".
    3. Liệt kê các lỗi đã sửa.
    `;
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    formattedDocument: {
      type: Type.STRING,
      description: "Toàn bộ nội dung văn bản dạng text thuần để hiển thị xem trước.",
    },
    structuredDocument: {
      type: Type.OBJECT,
      description: "Cấu trúc chi tiết để tạo file Word.",
      properties: {
        header: {
            type: Type.OBJECT,
            properties: {
                agencyName: { type: Type.STRING, description: "Tên cơ quan ban hành (viết hoa, ngắt dòng hợp lý). VD: ỦY BAN NHÂN DÂN\nTỈNH LÀO CAI" },
                agencyNumber: { type: Type.STRING, description: "Số và ký hiệu văn bản. VD: Số: 12/UBND-VP" },
                nationalName: { type: Type.STRING, description: "Luôn là: CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM" },
                motto: { type: Type.STRING, description: "Luôn là: Độc lập - Tự do - Hạnh phúc" },
                date: { type: Type.STRING, description: "Địa danh và ngày tháng. VD: Lào Cai, ngày 10 tháng 01 năm 2024" },
            },
            required: ["agencyName", "nationalName", "motto"]
        },
        body: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING, description: "Tên loại văn bản và trích yếu. Viết hoa in đậm. VD: QUYẾT ĐỊNH\nVề việc..." },
                paragraphs: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Danh sách các đoạn văn nội dung chính." }
            },
            required: ["title", "paragraphs"]
        },
        footer: {
            type: Type.OBJECT,
            properties: {
                recipients: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Danh sách nơi nhận. Bắt đầu bằng 'Nơi nhận:'" },
                signerTitle: { type: Type.STRING, description: "Chức vụ người ký. VD: TM. ỦY BAN NHÂN DÂN\nCHỦ TỊCH" },
                signerName: { type: Type.STRING, description: "Họ và tên người ký." }
            }
        }
      },
      required: ["header", "body", "footer"]
    },
    summary: {
      type: Type.STRING,
      description: "Tóm tắt ngắn gọn thay đổi.",
    },
    corrections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          section: { type: Type.STRING },
          originalText: { type: Type.STRING },
          correctedText: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ["section", "originalText", "correctedText", "reason"],
      },
    },
  },
  required: ["formattedDocument", "structuredDocument", "summary", "corrections"],
};

export const processDocument = async (file: UploadedFile): Promise<GeminiResponse> => {
  try {
    if (!process.env.API_KEY) {
      throw new Error("API key không được định nghĩa.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const filePart = await getFilePart(file);
    const prompt = getPrompt();

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [filePart, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.2,
      },
    });

    const jsonString = response.text.trim();
    const result = JSON.parse(jsonString);
    
    // Validate basic structure
    if (!result.formattedDocument || !result.structuredDocument) {
        throw new Error("Phản hồi từ AI thiếu dữ liệu cấu trúc.");
    }
    
    return result as GeminiResponse;

  } catch (error) {
    console.error("Lỗi khi xử lý văn bản:", error);
    if (error instanceof Error) {
        throw new Error(`Đã xảy ra lỗi khi giao tiếp với AI: ${error.message}`);
    }
    throw new Error("Đã xảy ra lỗi không xác định khi xử lý văn bản.");
  }
};
