// ============================================================
// NEWS AFRICA — Admin Dashboard Logic (Full CRUD)
// Handles auth, article creation, listing, editing, deletion.
// ============================================================

let supabaseClient = null;
let allArticles = [];        // cached list for search/filter
let deleteTargetId = null;   // article ID pending deletion

// --- DOM REFS (safe — called after DOM ready) ---
let $loginScreen, $dashboardScreen, $loginForm, $loginEmail, $loginPassword, $loginStatus;
let $topbarEmail, $topbarAvatar, $logoutBtn, $sidebarToggle, $sidebar;
let $uploadForm, $uploadStatus, $submitBtn, $submitBtnText, $cancelEditBtn, $editArticleId;
let $createSectionTitle, $createSectionDesc;
let $searchInput, $filterCategory, $articlesTableBody, $tableEmpty;
let $deleteModal, $deleteArticleTitle, $deleteModalCancel, $deleteModalConfirm;
let $fileUploadArea, $filePreview, $filePreviewImg, $fileRemoveBtn, $articleImage;

function cacheDom() {
  $loginScreen = document.getElementById('loginScreen');
  $dashboardScreen = document.getElementById('dashboardScreen');
  $loginForm = document.getElementById('loginForm');
  $loginEmail = document.getElementById('loginEmail');
  $loginPassword = document.getElementById('loginPassword');
  $loginStatus = document.getElementById('loginStatus');

  $topbarEmail = document.getElementById('topbarEmail');
  $topbarAvatar = document.getElementById('topbarAvatar');
  $logoutBtn = document.getElementById('logoutBtn');
  $sidebarToggle = document.getElementById('sidebarToggle');
  $sidebar = document.getElementById('adminSidebar');

  $uploadForm = document.getElementById('uploadForm');
  $uploadStatus = document.getElementById('uploadStatus');
  $submitBtn = document.getElementById('submitArticle');
  $submitBtnText = document.getElementById('submitBtnText');
  $cancelEditBtn = document.getElementById('cancelEditBtn');
  $editArticleId = document.getElementById('editArticleId');
  $createSectionTitle = document.getElementById('createSectionTitle');
  $createSectionDesc = document.getElementById('createSectionDesc');

  $searchInput = document.getElementById('searchInput');
  $filterCategory = document.getElementById('filterCategory');
  $articlesTableBody = document.getElementById('articlesTableBody');
  $tableEmpty = document.getElementById('tableEmpty');

  $deleteModal = document.getElementById('deleteModal');
  $deleteArticleTitle = document.getElementById('deleteArticleTitle');
  $deleteModalCancel = document.getElementById('deleteModalCancel');
  $deleteModalConfirm = document.getElementById('deleteModalConfirm');

  $fileUploadArea = document.getElementById('fileUploadArea');
  $filePreview = document.getElementById('filePreview');
  $filePreviewImg = document.getElementById('filePreviewImg');
  $fileRemoveBtn = document.getElementById('fileRemoveBtn');
  $articleImage = document.getElementById('articleImage');
}

// ============================================================
// INITIALIZATION
// ============================================================

function initAdmin() {
  cacheDom();

  if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
    showLoginError('Supabase SDK failed to load. Check your internet connection.');
    return;
  }

  if (!SUPABASE_URL || SUPABASE_URL.includes('YOUR_SUPABASE_URL') || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON')) {
    showLoginError('Supabase credentials not configured. Update config.js.');
    return;
  }

  // Custom storage to handle file:// protocol sandbox blocks
  var memoryStorage = {};
  var customStorage = {
    getItem: function(key) { try { return localStorage.getItem(key); } catch(e) { return memoryStorage[key] || null; } },
    setItem: function(key, value) { try { localStorage.setItem(key, value); } catch(e) { memoryStorage[key] = value; } },
    removeItem: function(key) { try { localStorage.removeItem(key); } catch(e) { delete memoryStorage[key]; } }
  };

  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { storage: customStorage, persistSession: true }
    });
    checkSession();
  } catch (err) {
    showLoginError('Failed to initialize: ' + err.message);
  }

  bindEvents();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdmin);
} else {
  initAdmin();
}

// ============================================================
// EVENT BINDING
// ============================================================

function bindEvents() {
  // Login
  $loginForm.addEventListener('submit', handleLogin);

  // Logout
  $logoutBtn.addEventListener('click', handleLogout);

  // Sidebar toggle (mobile)
  $sidebarToggle.addEventListener('click', function() {
    $sidebar.classList.toggle('open');
  });

  // Sidebar navigation
  document.querySelectorAll('.sidebar-link[data-section]').forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      switchSection(this.getAttribute('data-section'));
      // close mobile sidebar
      $sidebar.classList.remove('open');
    });
  });

  // Article form
  $uploadForm.addEventListener('submit', handleArticleSubmit);
  $cancelEditBtn.addEventListener('click', cancelEdit);

  // Search & filter
  $searchInput.addEventListener('input', renderFilteredArticles);
  $filterCategory.addEventListener('change', renderFilteredArticles);

  // New article button from manage page
  document.getElementById('btnNewFromManage').addEventListener('click', function() {
    cancelEdit();
    switchSection('create');
  });

  // Delete modal
  $deleteModalCancel.addEventListener('click', closeDeleteModal);
  $deleteModalConfirm.addEventListener('click', confirmDelete);
  $deleteModal.addEventListener('click', function(e) {
    if (e.target === $deleteModal) closeDeleteModal();
  });

  // File upload preview
  $articleImage.addEventListener('change', function() {
    var file = this.files[0];
    if (file) {
      var reader = new FileReader();
      reader.onload = function(e) {
        $filePreviewImg.src = e.target.result;
        $filePreview.style.display = 'block';
        $fileUploadArea.style.display = 'none';
      };
      reader.readAsDataURL(file);
    }
  });

  $fileRemoveBtn.addEventListener('click', function() {
    $articleImage.value = '';
    $filePreview.style.display = 'none';
    $fileUploadArea.style.display = '';
  });
}

// ============================================================
// AUTH
// ============================================================

async function checkSession() {
  if (!supabaseClient) return;
  try {
    var result = await supabaseClient.auth.getSession();
    if (result.data && result.data.session) {
      showDashboard(result.data.session.user);
    }
  } catch (err) {
    console.warn('Session check failed:', err);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  if (!supabaseClient) {
    showLoginError('Client not initialized.');
    return;
  }

  $loginStatus.textContent = 'Signing in…';
  $loginStatus.className = 'login-status';

  var email = $loginEmail.value.trim();
  var password = $loginPassword.value;

  try {
    var result = await supabaseClient.auth.signInWithPassword({ email: email, password: password });

    if (result.error) {
      var msg = result.error.message;
      if (msg.toLowerCase().includes('invalid login credentials')) {
        msg = 'Invalid email or password. Make sure you created this user in the Supabase Auth dashboard.';
      }
      showLoginError(msg);
      return;
    }

    showDashboard(result.data.user);
  } catch (err) {
    showLoginError('Unexpected error: ' + err.message);
  }
}

async function handleLogout() {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }
  $loginScreen.style.display = '';
  $dashboardScreen.style.display = 'none';
  $loginEmail.value = '';
  $loginPassword.value = '';
  $loginStatus.textContent = '';
}

function showLoginError(msg) {
  $loginStatus.textContent = msg;
  $loginStatus.className = 'login-status error';
}

function showDashboard(user) {
  $loginScreen.style.display = 'none';
  $dashboardScreen.style.display = 'flex';
  $topbarEmail.textContent = user.email;
  $topbarAvatar.textContent = (user.email || 'A').charAt(0).toUpperCase();
  loadDashboardData();
}

// ============================================================
// SECTION SWITCHING
// ============================================================

function switchSection(name) {
  // Update sidebar active
  document.querySelectorAll('.sidebar-link[data-section]').forEach(function(l) {
    l.classList.toggle('active', l.getAttribute('data-section') === name);
  });

  // Show/hide sections
  document.querySelectorAll('.dash-section').forEach(function(s) {
    s.classList.remove('active');
  });

  var target = document.getElementById('section' + capitalize(name));
  if (target) target.classList.add('active');

  // Refresh data when switching to manage
  if (name === 'manage') loadArticles();
  if (name === 'overview') loadDashboardData();
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

// ============================================================
// DASHBOARD OVERVIEW
// ============================================================

async function loadDashboardData() {
  if (!supabaseClient) return;

  try {
    var result = await supabaseClient.from('articles').select('*').order('created_at', { ascending: false });

    if (result.error) {
      console.error('Failed to load stats:', result.error);
      return;
    }

    var articles = result.data || [];

    // Stats
    document.getElementById('statTotal').textContent = articles.length;
    document.getElementById('statBreaking').textContent = articles.filter(function(a) { return a.is_breaking; }).length;
    document.getElementById('statVideos').textContent = articles.filter(function(a) { return a.video_url && a.video_url.length > 0; }).length;

    var today = new Date().toISOString().split('T')[0];
    document.getElementById('statToday').textContent = articles.filter(function(a) { return a.created_at && a.created_at.startsWith(today); }).length;

    // Category breakdown
    var cats = { news: 0, politics: 0, business: 0, sports: 0, entertainment: 0, health: 0, 'culture-society': 0, crime: 0, 'inside-africa': 0 };
    articles.forEach(function(a) { if (cats.hasOwnProperty(a.category)) cats[a.category]++; });

    var maxCat = Math.max(1, Math.max.apply(null, Object.values(cats)));
    var catColors = { news: '#e74c3c', politics: '#16a085', business: '#3498db', sports: '#2ecc71', entertainment: '#f39c12', health: '#9b59b6', 'culture-society': '#e84393', crime: '#c0392b', 'inside-africa': '#27ae60' };
    var barsHtml = '';

    Object.keys(cats).forEach(function(cat) {
      var pct = Math.round((cats[cat] / maxCat) * 100);
      barsHtml += '<div class="cat-bar-row">';
      barsHtml += '<span class="cat-label">' + formatCategoryName(cat) + '</span>';
      barsHtml += '<div class="cat-bar-track"><div class="cat-bar-fill" style="width:' + pct + '%;background:' + catColors[cat] + '"></div></div>';
      barsHtml += '<span class="cat-count">' + cats[cat] + '</span>';
      barsHtml += '</div>';
    });
    document.getElementById('categoryBars').innerHTML = barsHtml;

    // Recent articles (last 5)
    var recent = articles.slice(0, 5);
    var recentHtml = '';
    if (recent.length === 0) {
      recentHtml = '<div class="recent-empty">No articles yet. <a href="#" onclick="switchSection(\'create\');return false;">Create one</a>.</div>';
    } else {
      recent.forEach(function(a) {
        recentHtml += '<div class="recent-item">';
        recentHtml += '<div class="recent-dot" style="background:' + (catColors[a.category] || '#999') + '"></div>';
        recentHtml += '<div class="recent-info">';
        recentHtml += '<span class="recent-title">' + escapeHtml(a.title) + '</span>';
        recentHtml += '<span class="recent-meta">' + formatCategoryName(a.category || '') + ' · ' + timeAgo(a.created_at) + '</span>';
        recentHtml += '</div>';
        if (a.is_breaking) recentHtml += '<span class="badge-breaking">BREAKING</span>';
        recentHtml += '</div>';
      });
    }
    document.getElementById('recentList').innerHTML = recentHtml;

  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

// ============================================================
// MANAGE ARTICLES — LIST, SEARCH, FILTER
// ============================================================

async function loadArticles() {
  if (!supabaseClient) return;

  $articlesTableBody.innerHTML = '<tr><td colspan="6" class="table-loading">Loading articles…</td></tr>';
  $tableEmpty.style.display = 'none';

  try {
    var result = await supabaseClient.from('articles').select('*').order('created_at', { ascending: false });

    if (result.error) {
      $articlesTableBody.innerHTML = '<tr><td colspan="6" class="table-loading">Failed to load: ' + escapeHtml(result.error.message) + '</td></tr>';
      return;
    }

    allArticles = result.data || [];
    renderFilteredArticles();
  } catch (err) {
    $articlesTableBody.innerHTML = '<tr><td colspan="6" class="table-loading">Error: ' + escapeHtml(err.message) + '</td></tr>';
  }
}

function renderFilteredArticles() {
  var query = ($searchInput.value || '').toLowerCase().trim();
  var catFilter = $filterCategory.value;

  var filtered = allArticles.filter(function(a) {
    var matchesSearch = !query || (a.title || '').toLowerCase().includes(query) || (a.excerpt || '').toLowerCase().includes(query);
    var matchesCat = !catFilter || a.category === catFilter;
    return matchesSearch && matchesCat;
  });

  if (filtered.length === 0) {
    $articlesTableBody.innerHTML = '';
    $tableEmpty.style.display = 'block';
    document.getElementById('articlesTable').style.display = 'none';
    return;
  }

  $tableEmpty.style.display = 'none';
  document.getElementById('articlesTable').style.display = '';

  var catColors = { news: '#e74c3c', politics: '#16a085', business: '#3498db', sports: '#2ecc71', entertainment: '#f39c12', health: '#9b59b6', 'culture-society': '#e84393', crime: '#c0392b', 'inside-africa': '#27ae60' };

  var html = '';
  filtered.forEach(function(a) {
    var imgThumb = a.image_url
      ? '<img src="' + escapeAttr(a.image_url) + '" alt="" class="table-thumb">'
      : '<div class="table-thumb-placeholder"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>';

    html += '<tr>';
    html += '<td class="td-image">' + imgThumb + '</td>';
    html += '<td class="td-title">';
    html += '<span class="article-title-text">' + escapeHtml(a.title) + '</span>';
    if (a.video_url) html += ' <span class="badge-video">VIDEO</span>';
    html += '</td>';
    html += '<td class="td-category"><span class="badge-category" style="background:' + (catColors[a.category] || '#999') + '">' + escapeHtml(formatCategoryName(a.category || '')) + '</span></td>';
    html += '<td class="td-date">' + formatShortDate(a.created_at) + '</td>';
    html += '<td class="td-status">';
    if (a.is_breaking) html += '<span class="badge-breaking">BREAKING</span>';
    else html += '<span class="badge-published">Published</span>';
    html += '</td>';
    html += '<td class="td-actions">';
    html += '<button class="action-btn action-edit" title="Edit" data-id="' + a.id + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
    html += '<button class="action-btn action-delete" title="Delete" data-id="' + a.id + '" data-title="' + escapeAttr(a.title) + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
    html += '<a href="article.html?id=' + a.id + '" class="action-btn action-view" title="View" target="_blank"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></a>';
    html += '</td>';
    html += '</tr>';
  });

  $articlesTableBody.innerHTML = html;

  // Bind edit/delete buttons
  $articlesTableBody.querySelectorAll('.action-edit').forEach(function(btn) {
    btn.addEventListener('click', function() { startEdit(this.getAttribute('data-id')); });
  });
  $articlesTableBody.querySelectorAll('.action-delete').forEach(function(btn) {
    btn.addEventListener('click', function() {
      openDeleteModal(this.getAttribute('data-id'), this.getAttribute('data-title'));
    });
  });
}

// ============================================================
// CREATE / UPDATE ARTICLE
// ============================================================

async function handleArticleSubmit(e) {
  e.preventDefault();
  if (!supabaseClient) return;

  $submitBtn.disabled = true;
  $uploadStatus.textContent = 'Processing…';
  $uploadStatus.className = 'form-status';

  var title = document.getElementById('articleTitle').value.trim();
  var category = document.getElementById('articleCategory').value;
  var excerpt = document.getElementById('articleExcerpt').value.trim();
  var content = document.getElementById('articleContent').value.trim();
  var isBreaking = document.getElementById('articleBreaking').checked;
  var videoUrl = document.getElementById('articleVideo').value.trim();
  var fileInput = document.getElementById('articleImage');
  var file = fileInput.files[0];
  var editId = $editArticleId.value;

  // Validate
  if (!title || !category || !content) {
    showFormError('Title, category, and content are required.');
    $submitBtn.disabled = false;
    return;
  }

  // YouTube validation
  var videoId = null;
  if (videoUrl) {
    videoId = extractYouTubeId(videoUrl);
    if (!videoId) {
      showFormError('Invalid YouTube URL.');
      $submitBtn.disabled = false;
      return;
    }
  }

  var imageUrl = null;

  // Upload image if provided
  if (file) {
    $uploadStatus.textContent = 'Uploading image…';
    try {
      imageUrl = await uploadToImgBB(file);
    } catch (err) {
      showFormError('Image upload failed: ' + err.message);
      $submitBtn.disabled = false;
      return;
    }
  }

  $uploadStatus.textContent = editId ? 'Updating article…' : 'Saving article…';

  var row = {
    title: title,
    category: category,
    excerpt: excerpt,
    content: content,
    is_breaking: isBreaking,
    video_url: videoId ? 'https://www.youtube.com/embed/' + videoId : null
  };

  // Only update image if a new one was uploaded
  if (imageUrl) {
    row.image_url = imageUrl;
  }

  try {
    var result;
    if (editId) {
      // UPDATE
      result = await supabaseClient.from('articles').update(row).eq('id', editId);
    } else {
      // INSERT
      if (!imageUrl) row.image_url = null;
      result = await supabaseClient.from('articles').insert([row]);
    }

    if (result.error) {
      showFormError('Failed: ' + result.error.message);
      $submitBtn.disabled = false;
      return;
    }

    $uploadStatus.textContent = editId ? 'Article updated successfully!' : 'Article published successfully!';
    $uploadStatus.className = 'form-status success';
    $submitBtn.disabled = false;

    // Reset
    $uploadForm.reset();
    $editArticleId.value = '';
    $filePreview.style.display = 'none';
    $fileUploadArea.style.display = '';
    $cancelEditBtn.style.display = 'none';
    $submitBtnText.textContent = 'Publish Article';
    $createSectionTitle.textContent = 'Create New Article';
    $createSectionDesc.textContent = 'Fill in the details below to publish a new article.';

    // Auto-clear status
    setTimeout(function() {
      $uploadStatus.textContent = '';
    }, 4000);

  } catch (err) {
    showFormError('Unexpected error: ' + err.message);
    $submitBtn.disabled = false;
  }
}

function showFormError(msg) {
  $uploadStatus.textContent = msg;
  $uploadStatus.className = 'form-status error';
}

// ============================================================
// EDIT ARTICLE
// ============================================================

async function startEdit(id) {
  if (!supabaseClient) return;

  // Fetch article data
  try {
    var result = await supabaseClient.from('articles').select('*').eq('id', id).single();
    if (result.error || !result.data) {
      alert('Could not load article for editing.');
      return;
    }

    var a = result.data;

    // Switch to create section
    switchSection('create');

    // Populate form
    document.getElementById('articleTitle').value = a.title || '';
    document.getElementById('articleCategory').value = a.category || '';
    document.getElementById('articleExcerpt').value = a.excerpt || '';
    document.getElementById('articleContent').value = a.content || '';
    document.getElementById('articleBreaking').checked = a.is_breaking || false;
    document.getElementById('articleVideo').value = a.video_url || '';
    $editArticleId.value = a.id;

    // Show existing image
    if (a.image_url) {
      $filePreviewImg.src = a.image_url;
      $filePreview.style.display = 'block';
      $fileUploadArea.style.display = 'none';
    }

    // Update UI
    $createSectionTitle.textContent = 'Edit Article';
    $createSectionDesc.textContent = 'Modify the details below and save your changes.';
    $submitBtnText.textContent = 'Update Article';
    $cancelEditBtn.style.display = '';
    $uploadStatus.textContent = '';

  } catch (err) {
    alert('Error loading article: ' + err.message);
  }
}

function cancelEdit() {
  $uploadForm.reset();
  $editArticleId.value = '';
  $cancelEditBtn.style.display = 'none';
  $submitBtnText.textContent = 'Publish Article';
  $createSectionTitle.textContent = 'Create New Article';
  $createSectionDesc.textContent = 'Fill in the details below to publish a new article.';
  $uploadStatus.textContent = '';
  $filePreview.style.display = 'none';
  $fileUploadArea.style.display = '';
}

// ============================================================
// DELETE ARTICLE
// ============================================================

function openDeleteModal(id, title) {
  deleteTargetId = id;
  $deleteArticleTitle.textContent = title;
  $deleteModal.style.display = 'flex';
}

function closeDeleteModal() {
  deleteTargetId = null;
  $deleteModal.style.display = 'none';
}

async function confirmDelete() {
  if (!supabaseClient || !deleteTargetId) return;

  $deleteModalConfirm.disabled = true;
  $deleteModalConfirm.textContent = 'Deleting…';

  try {
    var result = await supabaseClient.from('articles').delete().eq('id', deleteTargetId);
    if (result.error) {
      alert('Delete failed: ' + result.error.message);
    } else {
      // Remove from cached list
      allArticles = allArticles.filter(function(a) { return a.id !== deleteTargetId; });
      renderFilteredArticles();
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }

  $deleteModalConfirm.disabled = false;
  $deleteModalConfirm.textContent = 'Delete';
  closeDeleteModal();
}

async function uploadToImgBB(file) {
  // Convert image file to base64 string
  var base64String = await new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function() {
      // Split off the metadata prefix (e.g. "data:image/jpeg;base64,")
      var base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = function(err) {
      reject(err);
    };
  });

  // Call the Supabase Edge Function 'upload-image'
  var result = await supabaseClient.functions.invoke('upload-image', {
    body: { imageBase64: base64String }
  });

  if (result.error) {
    throw new Error(result.error.message || 'Edge Function execution failed');
  }

  if (!result.data || !result.data.url) {
    throw new Error(result.data && result.data.error ? result.data.error : 'Failed to retrieve uploaded image URL');
  }

  return result.data.url;
}

// ============================================================
// YOUTUBE HELPER
// ============================================================

function extractYouTubeId(url) {
  if (!url) return null;
  url = url.trim();
  if (!url) return null;

  var patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];

  for (var i = 0; i < patterns.length; i++) {
    var match = url.match(patterns[i]);
    if (match) return match[1];
  }
  return null;
}

// ============================================================
// UTILITY HELPERS
// ============================================================

function timeAgo(dateStr) {
  var now = new Date();
  var then = new Date(dateStr);
  var diffMs = now - then;
  var diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return diffMins + ' min ago';
  var diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return diffHours + ' hr ago';
  var diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return diffDays + ' day' + (diffDays > 1 ? 's' : '') + ' ago';
  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatShortDate(dateStr) {
  var d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

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
