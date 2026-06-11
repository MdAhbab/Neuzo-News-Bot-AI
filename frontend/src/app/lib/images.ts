/** Editorial photography (Unsplash) — monochrome newsroom set for cohesion. */
const u = (id: string, w = 1400, h = 1000) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format`;

export const IMAGES = {
  press: u("1503694978374-8a2fa686963a"),
  article: u("1504711434969-e33886168f5c"),
  bundle: u("1523995462485-3d171b5c8fa9", 1200, 1500),
  pilesBw: u("1498644035638-2c3357894b10", 1400, 1600),
  shelf: u("1703381132774-caeab4f6a9db"),
  pile: u("1573812195421-50a396d17893"),
};
