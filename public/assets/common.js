// Shared helpers for the MOEST Media Command Center pages.
(function () {
  // Persisted theme (applied as early as possible to avoid a flash).
  if (localStorage.getItem('moest-theme') === 'light') document.documentElement.classList.remove('dark');

  window.toggleTheme = function () {
    const dark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('moest-theme', dark ? 'dark' : 'light');
  };

  // ---------- Tabs ----------
  const TABS = [
    { key: 'dashboard', href: '/', icon: 'fa-gauge-high', label: 'Dashboard' },
    { key: 'stories', href: '/stories.html', icon: 'fa-newspaper', label: 'Stories & Media' },
    { key: 'ministry', href: '/ministry-data.html', icon: 'fa-folder-tree', label: 'Ministry Data' },
  ];

  function renderTabs() {
    const nav = document.getElementById('appTabs');
    if (!nav) return;
    const active = nav.dataset.active;
    nav.className = 'bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800';
    nav.setAttribute('aria-label', 'Main sections');
    nav.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-1 overflow-x-auto">
        ${TABS.map((t) => `
          <a href="${t.href}" ${t.key === active ? 'aria-current="page"' : ''}
             class="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
               t.key === active
                 ? 'border-bahama-gold text-bahama-aqua dark:text-white'
                 : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
             }">
            <i class="fa-solid ${t.icon}"></i>${t.label}
          </a>`).join('')}
      </div>`;
  }
  document.addEventListener('DOMContentLoaded', renderTabs);

  // ---------- Utilities ----------
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      body: opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body,
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  function toast(message, type = 'ok') {
    let host = document.getElementById('toastHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toastHost';
      host.className = 'fixed bottom-4 right-4 z-[70] space-y-2';
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    const color = type === 'error' ? 'bg-rose-600' : 'bg-slate-900 dark:bg-slate-700';
    el.className = `${color} text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 max-w-sm`;
    el.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check text-emerald-400'}"></i><span>${esc(message)}</span>`;
    host.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  function timeAgo(date) {
    const d = new Date(date);
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 60) return 'Just now';
    if (s < 3600) return `${Math.floor(s / 60)} mins ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} hour${s < 7200 ? '' : 's'} ago`;
    return d.toLocaleDateString('en-BS', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const fmtDate = (date) =>
    new Date(date).toLocaleString('en-BS', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  const CHANNEL_ICONS = {
    News: 'fa-solid fa-newspaper',
    Facebook: 'fa-brands fa-facebook',
    X: 'fa-brands fa-x-twitter',
    Instagram: 'fa-brands fa-instagram',
    YouTube: 'fa-brands fa-youtube',
    TikTok: 'fa-brands fa-tiktok',
    Other: 'fa-solid fa-globe',
  };

  function sentimentBadge(s) {
    const map = {
      POSITIVE: ['bg-emerald-500/10 text-emerald-500 border-emerald-500/20', '+ Positive'],
      NEGATIVE: ['bg-rose-500/10 text-rose-500 border-rose-500/20', '- Negative'],
      NEUTRAL: ['bg-slate-500/10 text-slate-400 border-slate-500/20', '= Neutral'],
    };
    const [cls, label] = map[s] || map.NEUTRAL;
    return `<span class="text-[11px] font-bold px-2.5 py-0.5 rounded border ${cls}">${label}</span>`;
  }

  const paragraphs = (text) =>
    esc(text)
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('');

  const hostOf = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
  };

  // Turn a YouTube / Vimeo / Facebook / direct video URL into an inline player.
  function videoEmbed(url) {
    let u;
    try { u = new URL(url); } catch { return ''; }
    const host = u.hostname.replace(/^(www|m)\./, '');
    const frame = (src) =>
      `<div class="relative w-full aspect-video rounded-xl overflow-hidden bg-black shadow-lg">
         <iframe src="${esc(src)}" class="absolute inset-0 w-full h-full" title="Embedded video" loading="lazy"
           allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
       </div>`;
    let id = null;
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      id = u.searchParams.get('v') || (u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]+)/) || [])[1];
    } else if (host === 'youtu.be') {
      id = u.pathname.slice(1).split('/')[0];
    }
    if (id && /^[\w-]{6,20}$/.test(id)) return frame(`https://www.youtube-nocookie.com/embed/${id}`);
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const v = (u.pathname.match(/(\d{5,})/) || [])[1];
      if (v) return frame(`https://player.vimeo.com/video/${v}`);
    }
    if (host === 'facebook.com' || host === 'fb.watch') {
      return frame(`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`);
    }
    if (/\.(mp4|webm|ogg|mov)$/i.test(u.pathname)) {
      return `<video controls preload="metadata" class="w-full rounded-xl bg-black shadow-lg" src="${esc(url)}"></video>`;
    }
    return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer"
              class="flex items-center gap-3 p-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-bahama-aqua hover:underline">
              <i class="fa-solid fa-circle-play text-2xl"></i> Watch video on ${esc(hostOf(url))}</a>`;
  }

  // ---------- Export & sharing (PDF / PNG / SVG) ----------
  const EXPORT_OPTS = { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true, skipFonts: true };

  async function nodeToBlob(node, type) {
    if (type === 'png') return htmlToImage.toBlob(node, EXPORT_OPTS);
    if (type === 'svg') {
      const dataUrl = await htmlToImage.toSvg(node, EXPORT_OPTS);
      const svg = decodeURIComponent(dataUrl.slice(dataUrl.indexOf(',') + 1));
      return new Blob([svg], { type: 'image/svg+xml' });
    }
    if (type === 'pdf') {
      const pdf = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
      await appendNodeToPdf(pdf, node, true);
      return pdf.output('blob');
    }
    throw new Error('Unknown format');
  }

  // Renders a node into the PDF, slicing it across A4 pages when it is tall.
  async function appendNodeToPdf(pdf, node, isFirst) {
    const canvas = await htmlToImage.toCanvas(node, EXPORT_OPTS);
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const scale = canvas.width / pageW;
    const slicePx = Math.floor(pageH * scale);
    for (let y = 0, first = isFirst; y < canvas.height; y += slicePx, first = false) {
      const h = Math.min(slicePx, canvas.height - y);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = h;
      const ctx = slice.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, h);
      ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      if (!first) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, h / scale);
    }
  }

  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // Uses the device share sheet when it supports files, otherwise downloads.
  async function shareBlob(blob, filename, title) {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title });
        return 'shared';
      } catch (e) {
        if (e.name === 'AbortError') return 'cancelled';
      }
    }
    downloadBlob(blob, filename);
    return 'downloaded';
  }

  const fileSlug = (s) => String(s || 'document').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'document';

  window.MOEST = {
    esc, api, toast, timeAgo, fmtDate, CHANNEL_ICONS, sentimentBadge, paragraphs, hostOf, videoEmbed,
    nodeToBlob, appendNodeToPdf, downloadBlob, shareBlob, fileSlug,
  };
})();
