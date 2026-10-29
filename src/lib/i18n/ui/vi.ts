import type { MessageCatalog } from '../message-contract';

export const vi = {
  'header.language': 'Ngôn ngữ',
  'header.languageLocked': 'Hãy bắt đầu lại hoặc dừng bài luyện trước khi đổi ngôn ngữ.',
  'header.views': 'Các mục của ứng dụng',
  'view.practice': 'Luyện gõ',
  'view.keyboardTest': 'Kiểm tra bàn phím',
  'view.keyboardDetails': 'Thông tin bàn phím',
  'view.stats': 'Thống kê',
  'practice.start': 'Bắt đầu gõ',
  'practice.resume': 'Tiếp tục gõ',
  'practice.restart': 'Bắt đầu lại',
  'practice.finish': 'Hoàn tất',
  'practice.stop': 'Dừng',
  'practice.compositionCancelled': 'Phần đang nhập chưa xác nhận đã bị hủy. Nội dung đã xác nhận vẫn được giữ nguyên.',
  'practice.editRejected': 'Thao tác sửa này chưa được hỗ trợ. Hãy tiếp tục gõ ở cuối văn bản.',
  'practice.inputOverrun': 'Nội dung nhập vượt quá độ dài bài luyện. Hãy rút ngắn trước khi thử lại.',
  'practice.committedAccuracyHelp': 'Độ chính xác được tính theo nội dung đã xác nhận, không phải số lần nhấn phím của bộ gõ.',
  'text.unsupportedBrowser': 'Trình duyệt này không thể tách ký tự an toàn. Hãy cập nhật trình duyệt để luyện gõ.',
  'text.unsupportedCharacter': 'Ký tự không được hỗ trợ tại vị trí {position} (U+{codePoint}). Hãy dùng văn bản tiếng Anh hoặc tiếng Việt.',
  'text.empty': 'Hãy nhập ít nhất một ký tự được hỗ trợ.',
  'storage.languageNotSaved': 'Ngôn ngữ đã chọn được áp dụng trong lần truy cập này nhưng chưa được lưu. Tải lại trang có thể khôi phục ngôn ngữ trước đó.',
  'storage.retryPreferences': 'Thử lưu hoặc tải lại tùy chọn',
  'stats.allLanguages': 'Tất cả ngôn ngữ',
  'stats.committedAccuracy': 'Độ chính xác của nội dung đã xác nhận',
  'stats.legacyAccuracy': 'Độ chính xác theo lần nhấn phím trước đây',
  'stats.language': 'Ngôn ngữ'
} as const satisfies MessageCatalog;
