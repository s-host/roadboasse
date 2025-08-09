const app = document.getElementById("app");

function slugify(str) {
  return str.toLowerCase().replace(/[^\w]+/g, "-");
}

function isSameTrack(a, b) {
  return slugify(a.artist) === slugify(b.artist) &&
         slugify(a.title) === slugify(b.title);
}

// On page load, check if we’re at a track page
document.addEventListener("DOMContentLoaded", async () => {
  await loadTracks();
  await checkAdmin(); // also await this
  await router();     // wait for tracks before routing
});


function navigateTo(path) {
  history.pushState({}, "", path);
  router();
}

function updateUIForAdmin(isAdmin) {
  document.getElementById('login-button').style.display = isAdmin ? 'none' : 'inline-block';
  document.getElementById('logout-button').style.display = isAdmin ? 'inline-block' : 'none';
  document.getElementById('add-song-link').style.display = isAdmin ? 'inline-block' : 'none';
  document.getElementById('login-box').style.display = 'none'; // hide login form after login
}

let isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

function login() {
  localStorage.setItem("isLoggedIn", "true");
  isLoggedIn = true;
  navigateTo("/upload");
}

function logout() {
  localStorage.removeItem("isLoggedIn");
  isLoggedIn = false;
  navigateTo("/");
}

async function router() {
  const path = window.location.pathname;
  const segments = path.split("/").filter(Boolean);

  if (path === "/upload") {
    await checkAdminAndRedirect();
    if (!isLoggedIn) return; // stop rendering if not admin
    return renderUpload();
  }

  // homepage
  if (path === "/") return renderHome();

  // admin login page
  if (segments[0] === "login") return renderLogin();

  // artist and Song pages
  if (segments.length === 1) {
    return renderArtist(segments[0]);
  }

   if (segments[0] === "album" && segments[1]) {
  return renderAlbum(segments[1]);
  }

  if (segments.length === 2) {
    return renderSong(segments[0], segments[1]);
  }

  // default fallback
  renderNotFound();
}

window.onload = () => {
  checkAdmin();
};

function renderHome() {
  app.innerHTML = `
    <section>
      <h2 class="text-2xl mb-4 font-semibold">Newly Added</h2>
      <div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        ${tracks
          .filter(t => t.isNew)
          .map(renderTrackCard)
          .join("")}
      </div>
    </section>

    <section>
      <h2 class="text-2xl mb-4 font-semibold">Popular Tracks</h2>
      <div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        ${tracks
          .filter(t => t.isPopular)
          .map(renderTrackCard)
          .join("")}
      </div>
    </section>
  `;
}

function renderTrackCard(track) {
  const artistSlug = slugify(track.artist);
  const songSlug = slugify(track.title);

  return `
    <div class="bg-gray-800 rounded-lg overflow-hidden shadow-lg p-4 text-center track">
      <img src="${track.cover}" alt="${track.album}" class="w-32 h-32 mx-auto object-cover rounded mb-4" />
      <h3 class="text-lg font-bold hover:underline cursor-pointer" onclick="navigateTo('/${artistSlug}/${songSlug}')">
        ${track.title}
      </h3>
      <p class="text-sm text-gray-400 hover:underline cursor-pointer" onclick="navigateTo('/${artistSlug}')">
        ${track.artist}
      </p>
    </div>
  `;
}

function updateLoopButtonColor(btn, mode) {
  btn.classList.remove("loop1", "loopall", "noloop");

  if (mode === 2) btn.classList.add("loop1");
  else if (mode === 1) btn.classList.add("loopall");
  else btn.classList.add("noloop");
}

function renderSong(artistSlug, songSlug) {
  const track = tracks.find(
    t => slugify(t.artist) === artistSlug && slugify(t.title) === songSlug
  );

  if (!track) return renderNotFound();

  app.innerHTML = `
    <div class="max-w-xl mx-auto bg-gray-800 p-6 rounded-lg shadow-lg space-y-4 track">
      <img src="${track.cover}" alt="${track.album}" class="w-full h-full object-cover rounded"/>
      <h2 class="text-2xl font-bold">${track.title}</h2>
      <p class="text-gray-400 artistPointer">
        by <span class="hover:underline cursor-pointer" onclick="navigateTo('/${slugify(track.artist)}')">${track.artist}</span>
      </p>
      <p class="italic text-gray-500 hover:underline cursor-pointer albumPointer" onclick="navigateTo('/album/${slugify(track.album)}')">${track.album}</p>

      <div class="audio-player" style="display:flex; flex-direction:column; gap:12px; margin-top:1rem; color:#eee;">
        <audio id="audio" src="${track.file}"></audio>
        
        <div style="display:flex; align-items:center; gap:12px;">
          <button id="btnPlayPause" title="Play/Pause" style="cursor:pointer; background:none; border:none; color:#aaa; width:32px; height:32px;">
            <svg id="iconPlay" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-play">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <svg id="iconPause" style="display:none;" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-pause">
              <rect x="6" y="4" width="4" height="16"/>
              <rect x="14" y="4" width="4" height="16"/>
            </svg>
          </button>

          <div class="timestamp" id="timestamp">0:00 / 0:00</div>

          <button class="btn-loop timestamp" id="btnLoop" title="Toggle loop" aria-pressed="false" type="button" aria-label="Loop" style="cursor:pointer; background:none; border:none; color:#aaa; width:28px; height:28px; border-radius:4px; display:flex; align-items:center; justify-content:center; transition: color 0.3s, background-color 0.3s;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-repeat" style="width:20px; height:20px;">
              <polyline points="17 1 21 5 17 9"/>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
              <polyline points="7 23 3 19 7 15"/>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
            </svg>
          </button>

          <div class="volume-container" style="position:relative; display:flex; align-items:center;">
            <svg class="volume-icon" id="volumeIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px; height:24px; cursor:pointer;">
              <path d="M3 9v6h4l5 5V4L7 9H3z"></path>
            </svg>
            <input
              class="volume-slider"
              id="volumeSlider"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value="1"
              aria-label="Volume slider"
              style="position:absolute; bottom:36px; left:50%; transform:translateX(-50%); width:100px; background:#444; border-radius:4px; display:none;"
            />
          </div>
        </div>

        <input type="range" id="progressBar" value="0" min="0" max="100" step="0.1" style="
    width: 100%;
    height: 6px;
    background: #444;
    border-radius: 4px;
    outline: none;-webkit-appearance: none; appearance: none; cursor: pointer;">
      </div>

      ${isLoggedIn ? `<button onclick="deleteTrack('${track.artistSlug}', '${track.songSlug}')" class="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">Delete Track</button>` : ''}
    </div>

    <br>
  `;

  setupAudioPlayer(track);
}

function renderArtist(artistSlug) {
  const artistTracks = tracks.filter(t => slugify(t.artist) === artistSlug);
  if (!artistTracks.length) return renderNotFound();

  const artistName = artistTracks[0].artist;

  const albumMap = new Map();
  for (const track of artistTracks) {
    const albumSlug = slugify(track.album || "Unknown Album");
    if (!albumMap.has(albumSlug)) {
      albumMap.set(albumSlug, track);
    }
  }

  app.innerHTML = `
    <h2 class="text-2xl mb-4 font-bold">🎤 ${artistName}</h2>
    <div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 mb-10">
      ${artistTracks.map(renderTrackCard).join("")}
    </div>
    <h3 class="text-xl font-semibold mb-2">📀 Albums featuring ${artistName}</h3>
    <div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      ${[...albumMap.entries()].map(([slug, albumTrack]) => `
        <div class="bg-gray-800 rounded-lg shadow p-4 hover:bg-gray-700 transition duration-200 albumlink">
          <img src="${albumTrack.cover}" alt="${albumTrack.album}" class="w-full h-32 object-cover rounded mb-2" />
          <div class="font-semibold text-lg cursor-pointer hover:underline" onclick="navigateTo('/album/${slug}')">${albumTrack.album}</div>
        </div>
      `).join("")}
    </div>
    <br><br>
  `;

  setTimeout(adjustForPersistentBar, 0);
}

function isOnAlbumPage() {
  return window.location.pathname === `/album/${albumPlayer.albumSlug}`;
}

function adjustForPersistentBar() {
  const persistentBar = document.getElementById("persistent-album-bar");
  const bottomPadding = persistentBar ? persistentBar.offsetHeight + 24 : 0;

  document.documentElement.style.scrollPaddingBottom = `${bottomPadding}px`;

  window.scrollTo({ top: 0, behavior: "auto" });
}

function renderAlbum(albumSlug) {
  const matchingTracks = tracks.filter(t => slugify(t.album) === albumSlug);
  if (!matchingTracks.length) return renderNotFound();

  const sorted = matchingTracks.sort((a, b) => parseInt(a.albumNumber || 9999) - parseInt(b.albumNumber || 9999));
  const albumTitle = sorted[0].album;

  sorted.forEach(track => {
    const audio = new Audio(track.file);
    audio.addEventListener("loadedmetadata", () => {
      trackDurationMap[track.title] = formatTime(audio.duration);
      if (isOnAlbumPage()) renderAlbum(albumPlayer.albumSlug || albumSlug); // force update
    });
  });


  const artistCount = {};
  sorted.forEach(t => {
    artistCount[t.artist] = (artistCount[t.artist] || 0) + 1;
  });
  const sortedArtists = Object.entries(artistCount).sort((a, b) => b[1] - a[1]);

  app.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-6">
      <h2 class="text-3xl font-bold mb-2">
        ${albumTitle}
        <span class="text-sm text-gray-400 block mt-1 artistPointer">
          by ${sortedArtists.map(([name]) => `<span class="hover:underline cursor-pointer" onclick="navigateTo('/${slugify(name)}')">${name}</span>`).join(', ')}
        </span>
      </h2>
      <button class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white" onclick="playAlbumTracks('${albumSlug}')">▶ Play All</button>
      <div class="flex flex-col divide-y-4 divide-transparent mt-4">
        ${sorted.map((track, idx) => `
          <div class="p-4 flex justify-between items-center albumtrack">
            <div>
              <div class="text-lg font-semibold hover:underline cursor-pointer" onclick="playAlbumTrack('${albumSlug}', ${idx})">${track.title}</div>
              <div class="text-gray-400 text-sm albumtracktext hover:underline cursor-pointer" onclick="navigateTo('/${slugify(track.artist)}/${slugify(track.title)}')">
                #${track.albumNumber || '?'} <span class="text-xs text-gray-500 albumtracktext">(Track ${idx + 1})</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderNotFound() {
  app.innerHTML = `<h2 class="text-2xl font-bold text-red-400">404 - Not Found</h2>`;
}

function renderLogin() {
  app.innerHTML = `
    <div class="max-w-md mx-auto bg-gray-800 p-6 rounded-lg shadow-lg space-y-4">
      <h2 class="text-2xl font-bold">🔐 Admin Login</h2>
      <button onclick="login()" class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white">Login as Admin</button>
    </div>
  `;
}

function renderUpload() {
  app.innerHTML = `
    <div class="max-w-xl mx-auto bg-gray-800 p-6 rounded-lg shadow-lg space-y-4">
      <h2 class="text-2xl font-bold">📤 Upload New Track</h2>
      <form id="uploadForm" class="space-y-4">
        <input name="title" placeholder="Song Title" class="w-full p-2 rounded bg-gray-700" required />
        <input name="artist" placeholder="Artist" class="w-full p-2 rounded bg-gray-700" required />
        <input name="album" placeholder="Album" class="w-full p-2 rounded bg-gray-700" />
        <input name="cover" placeholder="Cover Image URL" class="w-full p-2 rounded bg-gray-700" />
        <input name="file" placeholder="Audio File URL (MP3/WAV)" class="w-full p-2 rounded bg-gray-700" required />
        <div class="flex gap-4">
          <label><input type="checkbox" name="isNew" /> New</label>
          <label><input type="checkbox" name="isPopular" /> Popular</label>
        </div>
        <button type="submit" class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white">Upload</button>
        <button onclick="logout()" type="button" class="ml-4 text-red-400 hover:underline">Log out</button>
      </form>
    </div>
  `;

  document.getElementById("uploadForm").onsubmit = async function (e) {
  e.preventDefault();
  const form = e.target;
  const newTrack = {
    title: form.title.value,
    artist: form.artist.value,
    album: form.album.value,
    cover: form.cover.value || "https://via.placeholder.com/300",
    file: form.file.value,
    isNew: form.isNew.checked,
    isPopular: form.isPopular.checked,
    albumNumber: albumNumber ? parseInt(albumNumber) : null,
  };

  const res = await fetch("/api/tracks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newTrack)
  });

  const savedTrack = await res.json();
    tracks.unshift(savedTrack.track);
    navigateTo("/");
  };
 
}

// album page stuff below this point //

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

let albumPlayer = {
  currentIndex: 0,
  tracks: [],
  albumSlug: '',
  loopMode: 0,
  audio: null,
  paused: false,
  volumeVisible: false
};

function playAlbumTrack(albumSlug, index) {
  playAlbumTracks(albumSlug);
  albumPlayer.currentIndex = index;
  startAlbumAudio();
  updatePersistentPlayer();
}

function playAlbumTracks(albumSlug) {
  albumPlayer.tracks = tracks
    .filter(t => slugify(t.album) === albumSlug)
    .sort((a, b) => parseInt(a.albumNumber || 9999) - parseInt(b.albumNumber || 9999));
  albumPlayer.currentIndex = 0;
  albumPlayer.albumSlug = albumSlug;
  albumPlayer.loopMode = 0;

  renderCurrentAlbumView();
  startAlbumAudio();
  updatePersistentPlayer();
}

function stopAlbumAudio() {
  if (albumPlayer.audio) {
    albumPlayer.audio.pause();
    albumPlayer.audio.src = '';
    albumPlayer.audio = null;
  }
}

function setupVolumeSlider(slider, audio) {
  if (!slider || !audio) return;

  const updateVolumeFill = () => {
    const percent = parseFloat(slider.value) * 100;
    slider.style.background = `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percent}%, #444 ${percent}%, #444 100%)`;
  };

  slider.addEventListener("input", () => {
    audio.volume = parseFloat(slider.value);
    updateVolumeFill();
  });

  updateVolumeFill();
}

function startAlbumAudio() {
  stopAlbumAudio();
  const bar = document.getElementById("persistent-album-bar");
  if (bar) bar.classList.remove("hide");
  const currentTrack = albumPlayer.tracks[albumPlayer.currentIndex];
  const audio = new Audio();
  albumPlayer.audio = audio;

  audio.src = currentTrack.file;
  audio.load();

  audio.addEventListener("canplaythrough", () => {
    audio.play();
  });

  audio.addEventListener("error", () => {
    console.error("Audio failed to load:", currentTrack.file);
  });
  albumPlayer.paused = false;

  // volume control setup
  audio.volume = 1;
  const persistentVolumeSlider = document.getElementById("volumeSlider");
  setupVolumeSlider(persistentVolumeSlider, albumPlayer.audio);

  audio.onended = () => {
    if (albumPlayer.loopMode === 2) {
      audio.currentTime = 0;
      audio.play();
    } else if (albumPlayer.currentIndex + 1 < albumPlayer.tracks.length) {
      albumPlayer.currentIndex++;
      if (isOnAlbumPage()) renderCurrentAlbumView();
      startAlbumAudio();
    } else if (albumPlayer.loopMode === 1) {
      albumPlayer.currentIndex = 0;
      startAlbumAudio();
    }
  };

  audio.ondurationchange = () => {
    const current = albumPlayer.tracks[albumPlayer.currentIndex];
    trackDurationMap[current.title] = formatTime(audio.duration);
    if (isOnAlbumPage()) renderCurrentAlbumView();
    updatePersistentPlayer();
  };

  audio.ontimeupdate = () => {
    const percent = (audio.currentTime / audio.duration) * 100;
    const bar = document.querySelector("#albumProgress");
    if (bar) {
      bar.value = percent;
      bar.style.background = `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percent}%, #444 ${percent}%, #444 100%)`; // will add themed bar laterrrr
    }

    const timestamp = document.querySelector("#albumTimestamp");
    if (timestamp) {
      timestamp.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    }
  };

  audio.play();
}

function renderCurrentAlbumView() {
  const currentTrack = albumPlayer.tracks[albumPlayer.currentIndex];
  const albumSlug = albumPlayer.albumSlug;
  const albumTitle = currentTrack.album;
  const uniqueArtists = {};

  for (let track of albumPlayer.tracks) {
    uniqueArtists[track.artist] = (uniqueArtists[track.artist] || 0) + 1;
  }
  const sortedArtists = Object.entries(uniqueArtists).sort((a, b) => b[1] - a[1]);

  app.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-6">
      <h2 class="text-3xl font-bold mb-2">
        ${albumTitle}
        <span class="text-sm text-gray-400 block mt-1 artistPointer">
          by ${sortedArtists.map(([name]) => `<span class='hover:underline cursor-pointer' onclick="navigateTo('/${slugify(name)}')">${name}</span>`).join(', ')}
        </span>
      </h2>
      <button class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white" onclick="playAlbumTracks('${albumSlug}')">▶ Restart Album</button>
      <div class="flex flex-col divide-y-4 divide-transparent mt-4">
        ${albumPlayer.tracks.map((track, idx) => `
          <div class="p-4 flex justify-between items-center albumtrack ${idx === albumPlayer.currentIndex ? 'bg-gray-700 currenttrack' : 'bg-gray-800'}">
            <div>
              <div class="text-lg font-semibold hover:underline cursor-pointer" onclick="playAlbumTrack('${albumSlug}', ${idx})">${track.title}</div>
              <div class="text-gray-400 text-sm albumtracktext hover:underline cursor-pointer" onclick="navigateTo('/${slugify(track.artist)}/${slugify(track.title)}')">
                #${track.albumNumber || '?'} <span class="text-xs text-gray-500 albumtracktext">(Track ${idx + 1})</span> • ${trackDurationMap[track.title] || '--:--'}
              </div>
            </div>
            ${idx === albumPlayer.currentIndex ? `<span class="text-green-400 text-sm playingtext">Playing...</span>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
    <br>
    <br>

  `;
}

function updatePersistentPlayer() {
  const current = albumPlayer.tracks[albumPlayer.currentIndex];
  let bar = document.getElementById("persistent-album-bar");

  if (!bar) {
    const container = document.createElement("div");
    container.id = "persistent-album-bar";
    container.className = "fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 px-4 py-3 flex items-center justify-between z-50";
    container.innerHTML = `
      <div class="flex items-center gap-4">
        <button onclick="albumPrevTrack()" class="text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" 
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>
          </svg>
        </button>
        <button onclick="toggleAlbumPlayPause()" class="text-white">
          <svg id="albumPlayIcon" ${!albumPlayer.paused ? 'style="display:none;"' : ''} 
               xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" 
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <svg id="albumPauseIcon" ${albumPlayer.paused ? 'style="display:none;"' : ''} 
               xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" 
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
          </svg>
        </button>
        <button onclick="albumNextTrack()" class="text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" 
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>
          </svg>
        </button>
        <div class="ml-4">
          <div class="font-semibold text-white text-sm" id="bar-track-title">${current.title}</div>
          <div class="text-gray-400 text-xs" id="bar-track-meta"></div>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <span id="albumTimestamp" class="text-gray-400 text-sm">0:00 / --:--</span>
        <input id="albumProgress" type="range" min="0" max="100" step="0.1" value="0" style="appearance: none; width: 200px; height: 6px; border-radius: 4px; cursor: pointer; outline: none;" />
        <div class="relative group volume-container">
          <svg class="volume-icon text-white cursor-pointer" id="volumeIcon" width="24" height="24" viewBox="0 0 24 24" 
               fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9v6h4l5 5V4L7 9H3z"/>
          </svg>
          <input type="range" id="volumeSlider" min="0" max="1" step="0.01" value="1"
            class="absolute left-1/2 transform -translate-x-1/2 bottom-8 hidden group-hover:block"
            style="width: 100px;" />
        </div>
        <button id="persistentLoopBtn" onclick="cycleAlbumLoopMode()" class="btn-loop ${albumPlayer.loopMode > 0 ? 'active' : ''} text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" 
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="17 1 21 5 17 9"/>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <polyline points="7 23 3 19 7 15"/>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
        </button>
      </div>
    `;
    document.body.appendChild(container);

    bar = container;

    const loopBtn = bar.querySelector("#persistentLoopBtn");
    loopBtn.classList.remove("loopall", "loop1", "noloop");

    if (albumPlayer.loopMode === 2) {
      loopBtn.classList.add("loop1");
    } else if (albumPlayer.loopMode === 1) {
      loopBtn.classList.add("loopall");
    } else {
      loopBtn.classList.add("noloop");
    }


    // progress bar seek
    const progress = bar.querySelector("#albumProgress");
    progress.addEventListener("input", () => {
      if (albumPlayer.audio?.duration) {
        const percent = parseFloat(progress.value);
        albumPlayer.audio.currentTime = (percent / 100) * albumPlayer.audio.duration;
      }
    });

    progress.addEventListener("click", (e) => {
      const rect = progress.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      if (albumPlayer.audio?.duration) {
        albumPlayer.audio.currentTime = percent * albumPlayer.audio.duration;
      }
    });

    // volume
    const volumeSlider = bar.querySelector("#volumeSlider");
    const volumeIcon = bar.querySelector("#volumeIcon");
    const volumeContainer = bar.querySelector(".volume-container");

    const updateVolumeFill = () => {
      const percent = parseFloat(volumeSlider.value) * 100;
      volumeSlider.style.background = `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percent}%, #444 ${percent}%, #444 100%)`;
    };

    volumeSlider.addEventListener("input", () => {
      if (albumPlayer.audio) {
        albumPlayer.audio.volume = parseFloat(volumeSlider.value);
        updateVolumeFill();
      }
    });

    albumPlayer.volumeVisible = albumPlayer.volumeVisible || false;

    volumeIcon.addEventListener("click", () => {
      albumPlayer.volumeVisible = !albumPlayer.volumeVisible;
      volumeSlider.style.display = albumPlayer.volumeVisible ? "block" : "none";
      volumeContainer.classList.toggle("active", albumPlayer.volumeVisible);
    });

    volumeContainer.addEventListener("mouseenter", () => {
      if (!albumPlayer.volumeVisible) volumeSlider.style.display = "block";
    });

    volumeContainer.addEventListener("mouseleave", () => {
      if (!albumPlayer.volumeVisible) volumeSlider.style.display = "none";
    });

    updateVolumeFill();

  }

  // always update track info and play/pause icons on track change
  bar.querySelector("#bar-track-title").textContent = current.title;
  bar.querySelector("#bar-track-meta").textContent = `${current.album} • ${current.artist}`;
  const playIcon = bar.querySelector("#albumPlayIcon");
  const pauseIcon = bar.querySelector("#albumPauseIcon");

  if (albumPlayer.paused) {
    playIcon.style.display = "block";
    pauseIcon.style.display = "none";
  } else {
    playIcon.style.display = "none";
    pauseIcon.style.display = "block";
  }

  const barMeta = bar.querySelector("#bar-track-meta");
  if (barMeta) {
    barMeta.innerHTML = "";

    const albumEl = document.createElement("span");
    albumEl.textContent = current.album;
    albumEl.className = "hover:underline cursor-pointer";
    albumEl.onclick = () => {
      history.pushState({}, "", '/album/' + slugify(current.album));
      renderCurrentAlbumView();
    };

    const separator = document.createTextNode(" • ");
    const artistText = document.createTextNode(current.artist);

    barMeta.appendChild(albumEl);
    barMeta.appendChild(separator);
    barMeta.appendChild(artistText);
  }

}

function toggleAlbumPlayPause(event) {
  if (event) event.stopPropagation();
  const audio = albumPlayer.audio;
  if (!audio) return; // <- add this line to guard

  if (audio.paused) {
    audio.play();
    albumPlayer.paused = false;
  } else {
    audio.pause();
    albumPlayer.paused = true;
  }

  updatePersistentPlayer();
  if (isOnAlbumPage()) renderCurrentAlbumView();
}

function cycleAlbumLoopMode() {
  albumPlayer.loopMode = (albumPlayer.loopMode + 1) % 3;
  updatePersistentPlayer();

  const loopBtn = document.getElementById("persistentLoopBtn");
  if (loopBtn) updateLoopButtonColor(loopBtn, albumPlayer.loopMode);

  if (isOnAlbumPage()) renderCurrentAlbumView();
}

function albumNextTrack(event) {
  if (event) event.stopPropagation();
  if (albumPlayer.currentIndex + 1 < albumPlayer.tracks.length) {
    albumPlayer.currentIndex++;
    if (isOnAlbumPage()) renderCurrentAlbumView();
    startAlbumAudio();
    updatePersistentPlayer();
  }
}

function albumPrevTrack(event) {
  if (event) event.stopPropagation();
  if (albumPlayer.currentIndex > 0) {
    albumPlayer.currentIndex--;
    if (isOnAlbumPage()) renderCurrentAlbumView();
    startAlbumAudio();
    updatePersistentPlayer();
  }
}

const trackDurationMap = {};

function setupAudioPlayer(track) {
  const audio = document.getElementById("audio");
  const playPause = document.getElementById("btnPlayPause");
  const iconPlay = document.getElementById("iconPlay");
  const iconPause = document.getElementById("iconPause");
  const progressBar = document.getElementById("progressBar");
  const timestamp = document.getElementById("timestamp");
  const loopBtn = document.getElementById("btnLoop");
  const volumeSlider = document.getElementById("volumeSlider");
  const volumeIcon = document.getElementById("volumeIcon");
  const albumAudio = albumPlayer.audio;
  const isShared = albumAudio &&
  albumPlayer.tracks.length === 1 &&
  isSameTrack(albumPlayer.tracks[0], track);


  let rafId = null;

  function updateProgress() {
    if (audio.duration) {
      const percent = (audio.currentTime / audio.duration) * 100;
      progressBar.value = percent;
      progressBar.style.background = `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percent}%, #444 ${percent}%, #444 100%)`;
      timestamp.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    }
    rafId = requestAnimationFrame(updateProgress);
  }

  playPause.addEventListener("click", () => {
    stopAlbumAudio();
    const bar = document.getElementById("persistent-album-bar");
    if (bar) bar.classList.add("hide");
    const isShared = albumPlayer.tracks.length === 1 && isSameTrack(albumPlayer.tracks[0], track);
    const albumAudio = albumPlayer.audio;

    if (audio.paused) {
      audio.play();
      iconPlay.style.display = "none";
      iconPause.style.display = "block";
      rafId = requestAnimationFrame(updateProgress);
    } else {
      audio.pause();
      iconPlay.style.display = "block";
      iconPause.style.display = "none";
      cancelAnimationFrame(rafId);
    }

    // if its already this song in albumPlayer, just toggle
    if (albumPlayer.audio.paused) {
      albumPlayer.audio.play();
      albumPlayer.paused = false;
    } else {
      albumPlayer.audio.pause();
      albumPlayer.paused = true;
    }

  if (isShared && albumAudio) {
    const updateProgress = () => {
      if (albumAudio.duration) {
        const percent = (albumAudio.currentTime / albumAudio.duration) * 100;
        progressBar.value = percent;
        progressBar.style.background = `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percent}%, #444 ${percent}%, #444 100%)`;
        timestamp.textContent = `${formatTime(albumAudio.currentTime)} / ${formatTime(albumAudio.duration)}`;
      }
      rafId = requestAnimationFrame(updateProgress);
    };

    iconPlay.style.display = albumAudio.paused ? "block" : "none";
    iconPause.style.display = albumAudio.paused ? "none" : "block";
    updateProgress();

    albumAudio.addEventListener("timeupdate", updateProgress);
  }

  if (isShared && albumAudio) {
    if (albumAudio.paused) {
      albumAudio.play();
      albumPlayer.paused = false;
    } else {
      albumAudio.pause();
      albumPlayer.paused = true;
    }

    iconPlay.style.display = albumAudio.paused ? "block" : "none";
    iconPause.style.display = albumAudio.paused ? "none" : "block";

    updatePersistentPlayer();
    renderCurrentAlbumView();
    return;
  }

  stopAlbumAudio();
  if (bar) bar.classList.add("hide");

  if (audio.paused) {
    audio.play();
    iconPlay.style.display = "none";
    iconPause.style.display = "block";
    rafId = requestAnimationFrame(updateProgress);
  } else {
    audio.pause();
    iconPlay.style.display = "block";
    iconPause.style.display = "none";
    cancelAnimationFrame(rafId);
  }
});


  audio.addEventListener("ended", () => {
    if (!audio.loop) {
      iconPlay.style.display = "block";
      iconPause.style.display = "none";
      cancelAnimationFrame(rafId);
    }
  });

  progressBar.addEventListener("input", () => {
    if (audio.duration) {
      const percent = parseFloat(progressBar.value);
      audio.currentTime = (percent / 100) * audio.duration;
      progressBar.style.background = `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percent}%, #444 ${percent}%, #444 100%)`;
    }
  });

  loopBtn.addEventListener("click", () => {
    audio.loop = !audio.loop;
    loopBtn.setAttribute("aria-pressed", audio.loop);
    updateLoopButtonColor(loopBtn, audio.loop ? 2 : 0); // Assume 2 = loop one track
  });


  track.volumeVisible = false;
  const volumeContainer = volumeIcon.parentElement;

  volumeIcon.addEventListener("click", () => {
    track.volumeVisible = !track.volumeVisible;
    volumeSlider.style.display = track.volumeVisible ? "block" : "none";
    volumeContainer.classList.toggle("active", track.volumeVisible);
  });

  volumeContainer.addEventListener("mouseenter", () => {
    if (!track.volumeVisible) {
      volumeSlider.style.display = "block";
    }
  });

  volumeContainer.addEventListener("mouseleave", () => {
    if (!track.volumeVisible) {
      volumeSlider.style.display = "none";
    }
  });


  function updateVolumeFill() {
  const percent = parseFloat(volumeSlider.value) * 100;
  volumeSlider.style.background = `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percent}%, #444 ${percent}%, #444 100%)`;
  }

  volumeSlider.addEventListener("input", () => {
    const volume = parseFloat(volumeSlider.value);
    audio.volume = volume;
    updateVolumeFill();
  });

  audio.volume = parseFloat(volumeSlider.value);
  updateVolumeFill();

}

function renderSongCard(song) {
  return `
    <div class="bg-gray-800 rounded-lg shadow p-4 hover:bg-gray-700 transition duration-200">
      <h3 class="text-xl font-semibold mb-2">${song.title}</h3>
      <p class="text-gray-400 mb-1">By ${song.artist}</p>
      <audio controls class="w-full mt-2">
        <source src="${song.audioUrl}" type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
    </div>
  `;
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/'/g, '')          // remove apostrophes
    .replace(/[^\w]+/g, '-')   // replace non-word chars with dash
    .replace(/^-+|-+$/g, '');  // trim starting/ending dashes
}

async function deleteTrack(artistSlug, songSlug) {
  try {
    const encodedArtistSlug = encodeURIComponent(artistSlug);
    const encodedSongSlug = encodeURIComponent(songSlug);

    const res = await fetch(`/api/tracks/${encodedArtistSlug}/${encodedSongSlug}`, {
      method: "DELETE"
    });
    if (res.ok) {
      tracks = tracks.filter(
        t => !(t.artistSlug === artistSlug && t.songSlug === songSlug)
      );

      const artistHasTracks = tracks.some(t => t.artistSlug === artistSlug);
      if (artistHasTracks) {
        navigateTo(`/${artistSlug}`);
      } else {
        navigateTo(`/`);
      }
    } else {
      const error = await res.text();
      alert(`Delete failed: ${error}`);
    }
  } catch (error) {
    alert(`Delete error: ${error.message}`);
  }
}

async function checkAdmin() {
  const res = await fetch("/api/is-admin");
  const data = await res.json();
  const isAdmin = data.isAdmin;

  isLoggedIn = isAdmin; // sync local variable

  const loginButton = document.getElementById("login-button");
  if (loginButton) {
    loginButton.style.display = isAdmin ? "none" : "block";
  }

  const logoutButton = document.getElementById("logout-button");
  if (logoutButton) {
    logoutButton.style.display = isAdmin ? "block" : "none";
  }

  const addSongLink = document.getElementById("add-song-link");
  if (addSongLink) {
    addSongLink.style.display = isAdmin ? "inline-block" : "none";
  }

  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.style.display = isAdmin ? "inline-block" : "none";
  });
}


function showLogin() {
  document.getElementById("login-box").style.display = "block";
}

async function submitLogin() {
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (res.ok) {
    alert("Logged in!");
    document.getElementById("login-box").style.display = "none";
    await checkAdmin(); // update UI after login
    navigateTo("/");    // optionally refresh view
  } else {
    alert("Login failed.");
  }
}

async function logout() {
  await fetch("/api/logout", { method: "POST" });
  alert("Logged out.");
  isLoggedIn = false;
  await checkAdmin(); // update UI after logout
  navigateTo("/");    // optionally refresh view
}

async function checkAdminAndRedirect() {
  const res = await fetch("/api/is-admin");
  const data = await res.json();
  if (!data.isAdmin) {
    alert("You must be an admin to access this page.");
    window.location.href = "/"; // redirect to homepage or login page
  } else {
    // show form or load page normally
  }
}

async function loadTracks() {
  const res = await fetch("/api/tracks");
  tracks = await res.json();

  tracks = tracks.map(t => ({
    ...t,
    slugArtist: slugify(t.artist),
    slugTitle: slugify(t.title),
    createdAt: t.createdAt || new Date().toISOString() // fallback if missing
  }));
}

window.addEventListener("popstate", router);
