// 밑줄(<u> 태그, text-decoration: underline 스타일)만 제거하는 함수
export function stripUnderline(html: string): string {
  if (!html) return '';
  // <u> 태그 제거
  html = html.replace(/<\/?u>/gi, '');
  // text-decoration: underline 스타일 제거
  html = html.replace(/(<[^>]+)style=("|')[^"']*text-decoration\s*:\s*underline;?[^"']*("|')/gi, (match, p1, p2, p3) => {
    // style 속성에서 text-decoration: underline만 제거
    let style = match.match(/style=("|')(.*?)("|')/i)?.[2] || '';
    style = style.replace(/text-decoration\s*:\s*underline;?/gi, '');
    // style 속성이 비면 제거
    if (style.trim()) {
      return `${p1}style="${style}"`;
    } else {
      return p1;
    }
  });
  return html;
} 