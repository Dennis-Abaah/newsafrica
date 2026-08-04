// ============================================================
// NEWS AFRICA — Public-facing application logic
// Fetches articles from Supabase and renders them on all pages.
// ============================================================

// We use "supabaseClient" to avoid colliding with the global "supabase"
// namespace that the CDN script (supabase-js@2) creates on window.
let supabaseClient = null;

function initApp() {
  if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function' &&
      SUPABASE_URL && !SUPABASE_URL.includes('YOUR_SUPABASE_URL') &&
      SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON')) {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
    }
  } else {
    const container = document.querySelector('.container') || document.body;
    const warning = document.createElement('div');
    warning.style.background = '#ffebee';
    warning.style.color = '#c62828';
    warning.style.padding = '20px';
    warning.style.margin = '20px auto';
    warning.style.border = '1px solid #ef9a9a';
    warning.style.maxWidth = '800px';
    warning.style.fontWeight = 'bold';
    warning.innerHTML = '⚠️ Configuration Required: Please update the Supabase project credentials in <code>config.js</code> to load articles.';
    container.insertBefore(warning, container.firstChild);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// --- UTILITY HELPERS ---

function timeAgo(dateStr) {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return diffMins + ' min ago';
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return diffHours + ' hr ago';
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return diffDays + ' day' + (diffDays > 1 ? 's' : '') + ' ago';
  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatCategoryName(category) {
  if (!category) return '';
  if (category === 'culture-society') return 'Culture & Society';
  if (category === 'inside-africa') return 'Inside Africa';
  return category.split(/[-_ ]+/).map(function(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

function getParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function placeholderImg() {
  return 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" fill="%23ddd"><rect width="640" height="360"/><text x="50%" y="50%" text-anchor="middle" dy=".35em" fill="%23999" font-family="Arial" font-size="18">No Image</text></svg>'
  );
}

function imgSrc(url) {
  return url || placeholderImg();
}

function videoEmbed(videoUrl) {
  if (!videoUrl) return '';
  return '<div class="video-embed"><iframe src="' + escapeAttr(videoUrl) + '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>';
}

function hasVideo(article) {
  return article.video_url && article.video_url.length > 0;
}

// --- NAV TOGGLE (mobile) ---
document.addEventListener('DOMContentLoaded', function () {
  const toggle = document.getElementById('navToggle');
  const navInner = document.getElementById('navBarInner');
  if (toggle && navInner) {
    // Relocate the toggle button outside of navBarInner so it doesn't get hidden when collapsed
    navInner.parentElement.insertBefore(toggle, navInner);
    
    toggle.addEventListener('click', function () {
      navInner.classList.toggle('open');
    });
  }
});


// ============================================================
// HOMEPAGE LOGIC (index.html)
// ============================================================

async function loadHomepage() {
  await loadBreakingBar();
  await loadTopStories();
  await loadCategorySection('news', 'homeSectionNews');
  await loadCategorySection('politics', 'homeSectionPolitics');
  await loadCategorySection('business', 'homeSectionBusiness');
  await loadCategorySection('sports', 'homeSectionSports');
  await loadCategorySection('entertainment', 'homeSectionEntertainment');
  await loadCategorySection('health', 'homeSectionHealth');
  await loadCategorySection('culture-society', 'homeSectionCultureSociety');
  await loadCategorySection('crime', 'homeSectionCrime');
  await loadCategorySection('inside-africa', 'homeSectionInsideAfrica');
}

async function loadBreakingBar() {
  if (!supabaseClient) return;
  const bar = document.getElementById('breakingBar');
  const track = document.getElementById('breakingTrack');
  if (!bar || !track) return;

  const { data, error } = await supabaseClient
    .from('articles')
    .select('id, title')
    .eq('is_breaking', true)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !data || data.length === 0) return;

  bar.classList.add('visible');
  // Duplicate items for seamless loop
  const items = [...data, ...data];
  track.innerHTML = items.map(a =>
    '<a href="article.html?id=' + a.id + '">' + escapeHtml(a.title) + '</a>'
  ).join('');
}

async function loadTopStories() {
  if (!supabaseClient) return;
  const container = document.getElementById('topStoriesGrid');
  if (!container) return;

  const { data, error } = await supabaseClient
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(6);

  if (error || !data || data.length === 0) {
    container.innerHTML = '<div class="empty-state">No stories available yet.</div>';
    return;
  }

  const lead = data[0];
  const sidebar = data.slice(1, 6);

  let html = '';

  // Lead story
  html += '<div class="story-lead">';
  if (hasVideo(lead)) {
    html += videoEmbed(lead.video_url);
  } else {
    html += '  <a href="article.html?id=' + lead.id + '">';
    html += '    <img src="' + imgSrc(lead.image_url) + '" alt="' + escapeAttr(lead.title) + '">';
    html += '  </a>';
  }
  html += '  <div class="story-title-wrap"><a href="article.html?id=' + lead.id + '" class="story-title">' + escapeHtml(lead.title) + '</a></div>';
  html += '  <p class="story-excerpt">' + escapeHtml(lead.excerpt || '') + '</p>';
  html += '  <div class="story-meta">' + escapeHtml(formatCategoryName(lead.category || '')) + ' &middot; ' + timeAgo(lead.created_at) + '</div>';
  html += '</div>';

  // Sidebar
  html += '<div class="story-sidebar">';
  sidebar.forEach(function (a) {
    html += '<div class="story-sidebar-item">';
    html += '  <a href="article.html?id=' + a.id + '"><img src="' + imgSrc(a.image_url) + '" alt="' + escapeAttr(a.title) + '"></a>';
    html += '  <div>';
    html += '    <a href="article.html?id=' + a.id + '" class="story-title">' + escapeHtml(a.title) + '</a>';
    html += '    <div class="story-meta">' + escapeHtml(formatCategoryName(a.category || '')) + ' &middot; ' + timeAgo(a.created_at) + '</div>';
    html += '  </div>';
    html += '</div>';
  });
  html += '</div>';

  container.innerHTML = html;
}

async function loadCategorySection(category, containerId) {
  if (!supabaseClient) return;
  const section = document.getElementById(containerId);
  if (!section) return;

  const { data, error } = await supabaseClient
    .from('articles')
    .select('*')
    .eq('category', category)
    .order('created_at', { ascending: false })
    .limit(4);

  if (error || !data || data.length === 0) {
    section.style.display = 'none';
    return;
  }

  let html = '<h2 class="section-heading"><a href="' + category + '.html">' + formatCategoryName(category) + '</a></h2>';
  html += '<div class="category-grid">';
  data.forEach(function (a) {
    html += '<div class="card">';
    if (hasVideo(a)) {
      html += '<div class="card-thumb-wrap"><a href="article.html?id=' + a.id + '"><img src="' + imgSrc(a.image_url) + '" alt="' + escapeAttr(a.title) + '"><span class="play-badge">&#9654; VIDEO</span></a></div>';
    } else {
      html += '  <a href="article.html?id=' + a.id + '"><img src="' + imgSrc(a.image_url) + '" alt="' + escapeAttr(a.title) + '"></a>';
    }
    html += '  <a href="article.html?id=' + a.id + '" class="card-title">' + escapeHtml(a.title) + '</a>';
    html += '  <p class="card-excerpt">' + escapeHtml(a.excerpt || '') + '</p>';
    html += '  <div class="card-meta">' + timeAgo(a.created_at) + '</div>';
    html += '</div>';
  });
  html += '</div>';
  section.innerHTML = html;
}


// ============================================================
// CATEGORY PAGE LOGIC (news.html, business.html, etc.)
// ============================================================

async function loadCategoryPage(category) {
  if (!supabaseClient) return;
  await loadBreakingBar();
  const container = document.getElementById('categoryListing');
  if (!container) return;

  container.innerHTML = '<div class="loading-indicator">Loading articles…</div>';

  const { data, error } = await supabaseClient
    .from('articles')
    .select('*')
    .eq('category', category)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error || !data || data.length === 0) {
    container.innerHTML = '<div class="empty-state">No articles in this category yet.</div>';
    return;
  }

  let html = '';
  data.forEach(function (a) {
    html += '<div class="listing-item">';
    if (hasVideo(a)) {
      html += '<div class="listing-video-wrap">' + videoEmbed(a.video_url) + '</div>';
    } else {
      html += '  <a href="article.html?id=' + a.id + '"><img src="' + imgSrc(a.image_url) + '" alt="' + escapeAttr(a.title) + '"></a>';
    }
    html += '  <div class="listing-body">';
    html += '    <a href="article.html?id=' + a.id + '" class="listing-title">' + escapeHtml(a.title) + '</a>';
    html += '    <p class="listing-excerpt">' + escapeHtml(a.excerpt || '') + '</p>';
    html += '    <div class="listing-meta">' + timeAgo(a.created_at) + '</div>';
    html += '  </div>';
    html += '</div>';
  });

  container.innerHTML = html;
}


// ============================================================
// ARTICLE PAGE LOGIC (article.html)
// ============================================================

async function loadArticle() {
  if (!supabaseClient) return;
  const articleId = getParam('id');
  const container = document.getElementById('articleContent');
  if (!container) return;

  if (!articleId) {
    container.innerHTML = '<div class="empty-state">Article not found.</div>';
    return;
  }

  container.innerHTML = '<div class="loading-indicator">Loading article…</div>';

  const { data, error } = await supabaseClient
    .from('articles')
    .select('*')
    .eq('id', articleId)
    .single();

  if (error || !data) {
    container.innerHTML = '<div class="empty-state">Article not found or could not be loaded.</div>';
    return;
  }

  // Update page title
  document.title = data.title + ' — News Africa';

  // Render article
  let html = '';
  html += '<div class="article-category">' + escapeHtml(formatCategoryName(data.category || '')) + '</div>';
  html += '<h1>' + escapeHtml(data.title) + '</h1>';
  html += '<div class="article-date">' + formatDate(data.created_at) + '</div>';
  if (hasVideo(data)) {
    html += videoEmbed(data.video_url);
  }
  // Content: convert plain-text line breaks to paragraphs
  const paragraphs = (data.content || '').split(/\n\n+/);
  const midPoint = Math.ceil(paragraphs.length / 2);
  
  const firstHalfHtml = paragraphs.slice(0, midPoint).map(function (p) {
    return '<p>' + escapeHtml(p.trim()) + '</p>';
  }).join('');
  
  const secondHalfHtml = paragraphs.slice(midPoint).map(function (p) {
    return '<p>' + escapeHtml(p.trim()) + '</p>';
  }).join('');

  html += '<div class="article-body">';
  html += firstHalfHtml;
  
  if (data.image_url) {
    html += '<img class="article-hero" src="' + imgSrc(data.image_url) + '" alt="' + escapeAttr(data.title) + '">';
  }
  
  html += secondHalfHtml;
  html += '</div>';

  container.innerHTML = html;
}


// ============================================================
// HTML ESCAPING
// ============================================================

function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
