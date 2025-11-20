
export interface Correction {
  section: string;
  originalText: string;
  correctedText: string;
  reason: string;
}

export interface StructuredDocument {
  header: {
    agencyName: string; // Tên cơ quan, tổ chức ban hành (Trái)
    agencyNumber: string; // Số ký hiệu (Trái - dưới tên cơ quan)
    nationalName: string; // Quốc hiệu (Phải)
    motto: string; // Tiêu ngữ (Phải - dưới quốc hiệu)
    date: string; // Địa danh, ngày tháng (Phải - dưới tiêu ngữ)
  };
  body: {
    title: string; // Tên loại văn bản và trích yếu nội dung
    paragraphs: string[]; // Nội dung chi tiết
  };
  footer: {
    recipients: string[]; // Nơi nhận (Trái)
    signerTitle: string; // Chức vụ (Phải)
    signerName: string; // Tên người ký (Phải)
  };
}

export interface GeminiResponse {
  formattedDocument: string; // Giữ lại để hiển thị nhanh trên web
  structuredDocument: StructuredDocument; // Dùng để generate file Word
  corrections: Correction[];
  summary: string;
}

export interface UploadedFile {
  name: string;
  type: string;
  size: number;
  base64: string;
}
