
import React, { useState, useCallback, useMemo } from 'react';
import { processDocument } from './services/geminiService.ts';
import type { GeminiResponse, UploadedFile, Correction } from './types.ts';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, VerticalAlign } from 'docx';

// --- Helper Functions ---
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string)
        .replace('data:', '')
        .replace(/^.+,/, '');
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

const processFile = async (file: File): Promise<UploadedFile> => {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'docx') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value;
      const base64 = btoa(unescape(encodeURIComponent(text)));
      return {
        name: file.name,
        type: 'text/plain',
        size: file.size,
        base64: base64,
      };
    } catch (error) {
      console.error("Lỗi đọc file DOCX:", error);
      throw new Error("Không thể đọc nội dung file Word (.docx).");
    }
  } else if (extension === 'doc') {
    throw new Error("Vui lòng chuyển đổi file .doc sang .docx trước khi tải lên.");
  }

  const base64 = await fileToBase64(file);
  return {
    name: file.name,
    type: file.type,
    size: file.size,
    base64: base64,
  };
};

// --- SVG Icons ---
const DocumentIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const UploadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const ClipboardIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
  </svg>
);

const LoadingSpinner: React.FC = () => (
    <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-lg font-semibold text-blue-700">Đang phân tích và định dạng lại văn bản...</p>
        <p className="text-gray-500 mt-2">Quá trình này có thể mất một vài phút. Vui lòng chờ.</p>
    </div>
);

// --- UI Components ---
const Header: React.FC = () => (
    <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex items-center">
            <DocumentIcon className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 ml-3">Trợ lý Soạn thảo NĐ30</h1>
        </div>
    </header>
);

const Footer: React.FC = () => (
    <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-gray-500 text-sm">
                © 2024 Trợ lý Soạn thảo Văn bản Hành chính. Tuân thủ Nghị định 30/2020/NĐ-CP.
            </p>
            <p className="text-gray-400 text-xs mt-2">
                Ứng dụng sử dụng trí tuệ nhân tạo Gemini để phân tích và hỗ trợ định dạng.
            </p>
        </div>
    </footer>
);

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
  selectedFile: File | null;
}
const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, isLoading, selectedFile }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      onFileSelect(event.target.files[0]);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      onFileSelect(event.dataTransfer.files[0]);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
        <label
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`flex justify-center w-full h-48 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-md appearance-none cursor-pointer hover:border-blue-500 focus:outline-none ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <span className="flex flex-col items-center justify-center space-x-2">
                <UploadIcon className="h-12 w-12 text-gray-500" />
                <span className="font-medium text-gray-600">
                    Kéo và thả tệp của bạn vào đây hoặc <span className="text-blue-600 underline">bấm để chọn tệp</span>
                </span>
                 <span className="text-sm text-gray-500">Hỗ trợ PDF, DOCX, TXT</span>
            </span>
            <input type="file" name="file_upload" className="hidden" onChange={handleFileChange} disabled={isLoading} accept=".pdf,.txt,.docx" />
        </label>
        {selectedFile && (
            <div className="mt-4 p-3 bg-gray-100 rounded-md text-center text-gray-700">
                Tệp đã chọn: <span className="font-semibold">{selectedFile.name}</span> ({(selectedFile.size / 1024).toFixed(2)} KB)
            </div>
        )}
    </div>
  );
};

interface ResultDisplayProps {
    result: GeminiResponse | null;
}
const ResultDisplay: React.FC<ResultDisplayProps> = ({ result }) => {
    if (!result) return null;

    const handleDownload = async () => {
        try {
            const { structuredDocument } = result;
            const { header, body, footer } = structuredDocument;

            // --- Styles ---
            const fontNormal = "Times New Roman";
            const sizeNormal = 28; // 14pt
            const sizeSmall = 26; // 13pt
            
            // --- HEADER TABLE (Invisible Borders) ---
            const headerRow = new TableRow({
                children: [
                    // Left Cell: Agency Name
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: { top: {style: BorderStyle.NONE}, bottom: {style: BorderStyle.NONE}, left: {style: BorderStyle.NONE}, right: {style: BorderStyle.NONE} },
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({ text: header.agencyName || "TÊN CƠ QUAN", font: fontNormal, size: sizeSmall, bold: true }), // Decree 30: 12-13pt
                                ],
                            }),
                             new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({ text: header.agencyNumber || "Số: ...", font: fontNormal, size: sizeSmall }),
                                ],
                                spacing: { after: 100 }
                            }),
                        ],
                        verticalAlign: VerticalAlign.TOP,
                    }),
                    // Right Cell: National Info
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                         borders: { top: {style: BorderStyle.NONE}, bottom: {style: BorderStyle.NONE}, left: {style: BorderStyle.NONE}, right: {style: BorderStyle.NONE} },
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({ text: header.nationalName || "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", font: fontNormal, size: sizeSmall, bold: true }), // Decree 30: 12-13pt
                                ],
                            }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({ text: header.motto || "Độc lập - Tự do - Hạnh phúc", font: fontNormal, size: sizeNormal, bold: true }), // Decree 30: 13-14pt
                                ],
                            }),
                            // Separator line logic would go here, but simplified for now
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({ text: "________________________", font: fontNormal, size: 10, bold: true }),
                                ],
                            }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({ text: header.date || "..., ngày ... tháng ... năm ...", font: fontNormal, size: 26, italics: true }), // Decree 30: 13-14pt Italic
                                ],
                                spacing: { before: 100 }
                            }),
                        ],
                        verticalAlign: VerticalAlign.TOP,
                    }),
                ],
            });

            const headerTable = new Table({
                rows: [headerRow],
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: { top: {style: BorderStyle.NONE}, bottom: {style: BorderStyle.NONE}, left: {style: BorderStyle.NONE}, right: {style: BorderStyle.NONE} },
            });

            // --- BODY ---
            const titleParagraph = new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 400, after: 240 },
                children: [
                    new TextRun({ text: body.title, font: fontNormal, size: sizeNormal, bold: true }),
                ],
            });

            const bodyParagraphs = body.paragraphs.map(p => new Paragraph({
                alignment: AlignmentType.JUSTIFIED, // Decree 30 requires Justified
                spacing: { after: 120, line: 276 }, // 1.15 - 1.2 line spacing standard
                indent: { firstLine: 567 }, // 1cm first line indent
                children: [new TextRun({ text: p, font: fontNormal, size: sizeNormal })],
            }));

            // --- FOOTER TABLE (Recipients & Signature) ---
            const recipientsText = footer.recipients && footer.recipients.length > 0 
                ? ["Nơi nhận:", ...footer.recipients].join('\n') 
                : "";

            const footerRow = new TableRow({
                children: [
                    // Recipients (Left)
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: { top: {style: BorderStyle.NONE}, bottom: {style: BorderStyle.NONE}, left: {style: BorderStyle.NONE}, right: {style: BorderStyle.NONE} },
                        children: footer.recipients ? [
                             new Paragraph({
                                children: [new TextRun({ text: "Nơi nhận:", font: fontNormal, size: 24, bold: true, italics: true })] // Size 12pt
                             }),
                             ...footer.recipients.map(r => new Paragraph({
                                 children: [new TextRun({ text: "- " + r, font: fontNormal, size: 22 })] // Size 11pt
                             }))
                        ] : [],
                        verticalAlign: VerticalAlign.TOP,
                    }),
                    // Signature (Right)
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: { top: {style: BorderStyle.NONE}, bottom: {style: BorderStyle.NONE}, left: {style: BorderStyle.NONE}, right: {style: BorderStyle.NONE} },
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({ text: footer.signerTitle || "THỦ TRƯỞNG CƠ QUAN", font: fontNormal, size: sizeNormal, bold: true }),
                                ],
                            }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                spacing: { before: 1200 }, // Space for signature
                                children: [
                                    new TextRun({ text: footer.signerName || "", font: fontNormal, size: sizeNormal, bold: true }),
                                ],
                            }),
                        ],
                        verticalAlign: VerticalAlign.TOP,
                    }),
                ],
            });

            const footerTable = new Table({
                rows: [footerRow],
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: { top: {style: BorderStyle.NONE}, bottom: {style: BorderStyle.NONE}, left: {style: BorderStyle.NONE}, right: {style: BorderStyle.NONE} },
            });

            // --- DOCUMENT ASSEMBLY ---
            const doc = new Document({
                sections: [{
                    properties: {
                        page: {
                            margin: {
                                top: 1134, // 2cm (approx)
                                bottom: 1134, // 2cm
                                left: 1701, // 3cm
                                right: 850, // 1.5cm
                            },
                        },
                    },
                    children: [
                        headerTable,
                        titleParagraph,
                        ...bodyParagraphs,
                        new Paragraph({ spacing: { before: 400 } }), // Spacer
                        footerTable
                    ],
                }],
            });

            const blob = await Packer.toBlob(doc);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = "Van_ban_chuan_nghi_dinh_30.docx";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Lỗi khi tạo file DOCX:", error);
            alert("Không thể tạo file tải xuống. Vui lòng thử lại.");
        }
    };

    const handleCopyReport = () => {
        const report = 
`BÁO CÁO RÀ SOÁT VĂN BẢN (NGHỊ ĐỊNH 30)
----------------------------------------
TÓM TẮT:
${result.summary}

CHI TIẾT CÁC LỖI ĐÃ SỬA:
${result.corrections.map((c, i) => `${i+1}. ${c.section}: "${c.originalText}" -> "${c.correctedText}"\n   Lý do: ${c.reason}`).join('\n')}
----------------------------------------
(Tạo bởi Trợ lý Soạn thảo Văn bản)`;
        
        navigator.clipboard.writeText(report)
            .then(() => alert("Đã sao chép báo cáo vào bộ nhớ đệm! Bạn có thể dán vào Zalo/Email ngay."))
            .catch(() => alert("Không thể sao chép."));
    };

    return (
        <div className="mt-8 space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b-2 border-blue-500 pb-2">Tóm tắt</h2>
                <p className="text-gray-700 bg-blue-50 p-4 rounded-lg border border-blue-100">{result.summary}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="lg:col-span-1 flex flex-col h-full">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b-2 border-blue-500 pb-2 gap-2">
                         <h2 className="text-2xl font-bold text-gray-800">Văn bản đã sửa</h2>
                         <div className="flex space-x-2">
                            <button 
                                onClick={handleCopyReport}
                                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                                title="Sao chép báo cáo lỗi để gửi nhanh"
                            >
                                <ClipboardIcon className="h-5 w-5 mr-1 text-gray-500" />
                                Sao chép BC
                            </button>
                             <button 
                                onClick={handleDownload}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                             >
                                <DownloadIcon className="h-5 w-5 mr-2" />
                                Tải về .docx
                             </button>
                         </div>
                    </div>
                    <div className="bg-white p-8 rounded-lg shadow-sm h-[600px] overflow-y-auto border border-gray-200 flex-grow">
                         {/* Preview rendering (simplified HTML version of the Docx) */}
                        <div className="font-serif text-gray-900 leading-relaxed">
                            <div className="flex justify-between mb-4 text-center text-sm">
                                <div className="w-1/2">
                                    <p className="font-bold uppercase">{result.structuredDocument.header.agencyName}</p>
                                    <p>{result.structuredDocument.header.agencyNumber}</p>
                                </div>
                                <div className="w-1/2">
                                    <p className="font-bold uppercase">{result.structuredDocument.header.nationalName}</p>
                                    <p className="font-bold">{result.structuredDocument.header.motto}</p>
                                    <p className="italic mt-1">{result.structuredDocument.header.date}</p>
                                </div>
                            </div>
                            <div className="text-center font-bold text-lg my-6 uppercase whitespace-pre-wrap">
                                {result.structuredDocument.body.title}
                            </div>
                            <div className="space-y-4 text-justify">
                                {result.structuredDocument.body.paragraphs.map((p, i) => (
                                    <p key={i} className="indent-8">{p}</p>
                                ))}
                            </div>
                            <div className="flex justify-between mt-8 text-sm">
                                <div className="w-1/2">
                                    {result.structuredDocument.footer.recipients && (
                                        <>
                                            <p className="font-bold italic">Nơi nhận:</p>
                                            <ul className="list-none pl-0">
                                                {result.structuredDocument.footer.recipients.map((r, i) => (
                                                    <li key={i}>- {r}</li>
                                                ))}
                                            </ul>
                                        </>
                                    )}
                                </div>
                                <div className="w-1/2 text-center">
                                    <p className="font-bold uppercase">{result.structuredDocument.footer.signerTitle}</p>
                                    <div className="h-16"></div>
                                    <p className="font-bold">{result.structuredDocument.footer.signerName}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-1 flex flex-col h-full">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b-2 border-red-500 pb-2">Các Lỗi đã sửa ({result.corrections.length})</h2>
                    <div className="space-y-4 h-[600px] overflow-y-auto pr-2">
                        {result.corrections.map((correction, index) => (
                            <div key={index} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                                <span className="inline-block bg-red-100 text-red-800 text-sm font-medium mr-2 px-2.5 py-0.5 rounded-full">{correction.section}</span>
                                <p className="mt-2 text-sm text-gray-500">
                                    <span className="font-semibold">Gốc:</span> "{correction.originalText}"
                                </p>
                                <p className="mt-1 text-sm text-green-700">
                                    <span className="font-semibold">Đã sửa:</span> "{correction.correctedText}"
                                </p>
                                <p className="mt-2 text-sm text-blue-800 bg-blue-50 p-2 rounded-md">
                                    <span className="font-semibold">Lý do:</span> {correction.reason}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Main App Component ---
export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeminiResponse | null>(null);

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setResult(null);
    setError(null);
  }, []);

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError("Vui lòng chọn một tệp để xử lý.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const uploadedFile = await processFile(selectedFile);
      const response = await processDocument(uploadedFile);
      setResult(response);
    } catch (e: any) {
      setError(e.message || "Đã có lỗi xảy ra.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const canSubmit = useMemo(() => selectedFile && !isLoading, [selectedFile, isLoading]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
      <Header />
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 flex-grow w-full">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Chuẩn hóa văn bản hành chính
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-500">
            Tải lên văn bản của bạn để tự động kiểm tra chính tả, thể thức và định dạng lại theo tiêu chuẩn Nghị định 30/2020/NĐ-CP.
          </p>
        </div>

        <div className="p-8 bg-white rounded-xl shadow-lg border border-gray-200">
          <FileUpload onFileSelect={handleFileSelect} isLoading={isLoading} selectedFile={selectedFile} />
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-md"
            >
              {isLoading ? 'Đang xử lý...' : 'Kiểm tra & Sửa lỗi ngay'}
            </button>
          </div>
        </div>

        {error && (
            <div className="mt-8 bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-md shadow-sm" role="alert">
                <p className="font-bold flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Lỗi
                </p>
                <p>{error}</p>
            </div>
        )}

        {isLoading && <div className="mt-8"><LoadingSpinner/></div>}

        {result && <ResultDisplay result={result} />}

      </main>
      <Footer />
    </div>
  );
}
