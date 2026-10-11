import { guides } from './tool-guides.ts';
import { homeSeo } from './site-seo.ts';

export const socialTitles: Record<string, string> = {
  index: homeSeo.title,
  privacy: '개인정보 처리방침',
  '404': '페이지를 찾을 수 없음',
  ...Object.fromEntries(Object.entries(guides).map(([key, guide]) => [key, guide.title])),
};
