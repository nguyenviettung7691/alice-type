import type { Quote } from '../quote-catalog';

const original = {
  language: 'vi' as const,
  author: 'AliceType original practice passages',
  sourceUrl: 'https://github.com/nguyenviettung7691/alice-type/blob/main/src/lib/typing/quotes/vi.ts',
  rights: 'Original AI-assisted AliceType practice passages, 2026. Distributed under the application MIT license; not literary quotations or translations.',
  reviewedAt: '2026-10-29',
  adaptationNote: 'Written for AliceType; NFC text with ASCII punctuation. Automated repertoire and length checks only; fluent Vietnamese editorial review is pending.'
};

export const VI_QUOTES: readonly Quote[] = Object.freeze([
  {
    ...original, workTitle: 'AliceType: Buổi sáng quanh nhà',
    id: 'vi-morning-window',
    text: 'Buổi sáng, tôi mở cửa sổ để đón làn gió mát. Trên bậu cửa, chậu cây nhỏ đã có thêm một chiếc lá mới.'
  },
  {
    ...original, workTitle: 'AliceType: Buổi sáng quanh nhà',
    id: 'vi-morning-breakfast',
    text: 'Mẹ đặt bát cháo nóng lên bàn, còn tôi rót nước cho cả nhà. Chúng tôi ăn sáng chậm rãi và kể cho nhau nghe kế hoạch trong ngày.'
  },
  {
    ...original, workTitle: 'AliceType: Buổi sáng quanh nhà',
    id: 'vi-morning-garden',
    text: 'Sau cơn mưa đêm, khu vườn thơm mùi đất ẩm. Tôi tưới thêm một ít nước cho luống rau dưới mái hiên rồi cất chiếc bình vào góc sân.'
  },
  {
    ...original, workTitle: 'AliceType: Buổi sáng quanh nhà',
    id: 'vi-morning-notebook',
    text: 'Trước khi ra khỏi nhà, tôi ghi vài việc cần làm vào sổ. Một trang giấy nhỏ giúp tôi nhớ mua gạo, trả sách và gọi điện cho bà.'
  },
  {
    ...original, workTitle: 'AliceType: Những bước chân trong phố',
    id: 'vi-city-market',
    text: 'Chợ sớm đã đông người mua bán. Tôi chọn một bó rau xanh, vài quả cà chua và một túi cam, rồi xếp mọi thứ gọn gàng vào giỏ.'
  },
  {
    ...original, workTitle: 'AliceType: Những bước chân trong phố',
    id: 'vi-city-bus',
    text: 'Xe buýt dừng bên hàng cây trước cổng trường. Tôi nhường đường cho người xuống xe, bước lên và tìm một chỗ đứng gần tay vịn.'
  },
  {
    ...original, workTitle: 'AliceType: Những bước chân trong phố',
    id: 'vi-city-library',
    text: 'Thư viện chiều nay khá yên tĩnh. Bên cửa sổ, một bạn nhỏ đang đọc truyện, còn tôi tìm cuốn sách về những loài chim sống gần sông.'
  },
  {
    ...original, workTitle: 'AliceType: Những bước chân trong phố',
    id: 'vi-city-rain',
    text: 'Mưa bất chợt rơi khi tôi đi qua tiệm bánh. Tôi đứng dưới mái hiên, nghe tiếng nước chảy và chờ đèn bên kia đường chuyển sang màu xanh.'
  },
  {
    ...original, workTitle: 'AliceType: Những điều nhỏ mỗi ngày',
    id: 'vi-everyday-letter',
    text: 'Tôi viết một lá thư ngắn gửi bạn ở xa. Trong thư không có chuyện gì lớn, chỉ có vài dòng về khu phố, thời tiết và chú mèo mới đến nhà.'
  },
  {
    ...original, workTitle: 'AliceType: Những điều nhỏ mỗi ngày',
    id: 'vi-everyday-learning',
    text: 'Mỗi ngày, tôi dành một lúc để học điều mới. Có hôm tôi tập nấu một món ăn, có hôm tôi đọc chậm một trang sách và ghi lại câu hỏi.'
  },
  {
    ...original, workTitle: 'AliceType: Những điều nhỏ mỗi ngày',
    id: 'vi-everyday-repair',
    text: 'Chiếc ghế gỗ cũ hơi lung lay, nên bố và tôi cùng sửa lại. Khi công việc xong, chúng tôi lau sạch mặt ghế và đặt nó bên bàn uống nước.'
  },
  {
    ...original, workTitle: 'AliceType: Những điều nhỏ mỗi ngày',
    id: 'vi-everyday-evening',
    text: 'Buổi tối, cả nhà cùng dọn bát đĩa rồi ngồi trò chuyện. Ngoài ngõ, tiếng bước chân thưa dần, chỉ còn ánh đèn vàng soi lên bức tường cũ.'
  }
].map((quote) => Object.freeze(quote)));
