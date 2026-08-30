/**
 * Generates sample procedural canvas background images for 1-click testing
 */

export function createSampleCertificateBackground() {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 850;
  const ctx = canvas.getContext('2d');

  // Rich Dark Gold / Slate Gradient
  const grad = ctx.createLinearGradient(0, 0, 1200, 850);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.5, '#1e1b4b');
  grad.addColorStop(1, '#090d16');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1200, 850);

  // Outer Gold Border
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 14;
  ctx.strokeRect(30, 30, 1140, 790);

  // Inner Fine Accent Border
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.strokeRect(45, 45, 1110, 760);

  // Corner Ornaments
  const corners = [[60, 60], [1140, 60], [60, 790], [1140, 790]];
  ctx.fillStyle = '#f59e0b';
  corners.forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fill();
  });

  // Header Title
  ctx.font = '700 48px "Cinzel", Georgia, serif';
  ctx.fillStyle = '#f59e0b';
  ctx.textAlign = 'center';
  ctx.fillText('CERTIFICATE OF ACHIEVEMENT', 600, 150);

  // Subheader
  ctx.font = '400 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('THIS IS PROUDLY PRESENTED TO', 600, 230);

  // Footer Lines
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(250, 720);
  ctx.lineTo(480, 720);
  ctx.moveTo(720, 720);
  ctx.lineTo(950, 720);
  ctx.stroke();

  ctx.font = '500 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText('ORGANIZATION PRESIDENT', 365, 750);
  ctx.fillText('PROGRAM CHAIRPERSON', 835, 750);

  return canvas.toDataURL('image/png');
}

export function createSampleCompanyFrameOverlay() {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 1000;
  const ctx = canvas.getContext('2d');

  // Transparent center, rich frame border
  ctx.clearRect(0, 0, 1000, 1000);

  // Frame Outer Ring
  const frameGrad = ctx.createLinearGradient(0, 0, 1000, 1000);
  frameGrad.addColorStop(0, '#6366f1');
  frameGrad.addColorStop(0.5, '#a855f7');
  frameGrad.addColorStop(1, '#ec4899');

  ctx.strokeStyle = frameGrad;
  ctx.lineWidth = 40;
  ctx.strokeRect(20, 20, 960, 960);

  // Top Logo Badge Container
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(350, 0, 300, 70);
  ctx.strokeStyle = '#818cf8';
  ctx.lineWidth = 4;
  ctx.strokeRect(350, 0, 300, 70);

  ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('ACME CORP OFFICIAL', 500, 42);

  // Bottom Banner
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(200, 910, 600, 90);
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 3;
  ctx.strokeRect(200, 910, 600, 90);

  ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#f472b6';
  ctx.fillText('ANNUAL DOCUMENTATION 2026', 500, 960);

  return canvas.toDataURL('image/png');
}

export function createSampleTeamBadgeBackground() {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 900;
  const ctx = canvas.getContext('2d');

  // Deep dark theme
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 900);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(0.4, '#1e293b');
  bgGrad.addColorStop(1, '#020617');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 600, 900);

  // Header Banner
  const bannerGrad = ctx.createLinearGradient(0, 0, 600, 0);
  bannerGrad.addColorStop(0, '#6366f1');
  bannerGrad.addColorStop(1, '#a855f7');
  ctx.fillStyle = bannerGrad;
  ctx.fillRect(0, 0, 600, 160);

  ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('INNOVATION TEAM', 300, 90);

  // Avatar Placeholder Circle
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(300, 320, 110, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#818cf8';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(300, 320, 110, 0, Math.PI * 2);
  ctx.stroke();

  // Avatar Silhouette
  ctx.fillStyle = '#64748b';
  ctx.beginPath();
  ctx.arc(300, 290, 45, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(300, 410, 75, Math.PI, 0);
  ctx.fill();

  // Card Footer line
  ctx.fillStyle = '#6366f1';
  ctx.fillRect(0, 880, 600, 20);

  return canvas.toDataURL('image/png');
}

export const SAMPLE_CSV_DATA = [
  {
    first_name: 'Alexander',
    middle_name: 'James',
    last_name: 'Wright',
    nickname: 'Alex',
    section: 'BSCS-3A',
    year: '2026',
    department: 'Engineering',
    role: 'Lead Architect',
    student_id: 'DEV-9081',
    layout_name: 'Executive Layout',
    qr_data: 'https://company.org/verify/DEV-9081'
  },
  {
    first_name: 'Sophia',
    middle_name: 'Marie',
    last_name: 'Chen',
    nickname: '', // Empty nickname - tests fallback to first_name "Sophia"!
    section: 'BSCS-3A',
    year: '2026',
    department: 'Engineering',
    role: 'Senior Developer',
    student_id: 'DEV-9082',
    layout_name: 'Executive Layout',
    qr_data: 'https://company.org/verify/DEV-9082'
  },
  {
    first_name: 'Marcus',
    middle_name: 'Vance',
    last_name: 'Rodriguez',
    nickname: 'Marc',
    section: 'BSIT-4B',
    year: '2025',
    department: 'Design',
    role: 'UI/UX Specialist',
    student_id: 'DES-4011',
    layout_name: 'Standard Staff',
    qr_data: 'https://company.org/verify/DES-4011'
  },
  {
    first_name: 'Elena',
    middle_name: '',
    last_name: 'Rostova',
    nickname: 'Nena',
    section: 'BSIT-4B',
    year: '2025',
    department: 'Design',
    role: 'Creative Director',
    student_id: 'DES-4012',
    layout_name: 'Standard Staff',
    qr_data: 'https://company.org/verify/DES-4012'
  }
];
