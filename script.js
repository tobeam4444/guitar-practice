// ==================== 전역 변수 ====================
let musicFiles = [];
let sheetFiles = [];
let settings = {
    playbackRate: 1.0,
    countdownSeconds: 10,
    loopEnabled: false,
    autoScrollEnabled: true,
    favoriteMode: false
};
let popupPlaybackRate = 1.0;
let currentSongIndex = -1;
let allSongs = [];
let filteredSongs = [];
let isSearchMode = false;
let favoriteSongs = JSON.parse(localStorage.getItem('favoriteSongs') || '[]');
let currentAudio = null;
let countdownTimer = null;

// ==================== 초기화 ====================
window.addEventListener('load', loadFiles);

// ==================== 슬라이더 이벤트 ====================
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');

speedSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    settings.playbackRate = value;
    speedValue.textContent = value.toFixed(1) + 'x';
});

const countdownSlider = document.getElementById('countdownSlider');
const countdownValue = document.getElementById('countdownValue');

countdownSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    settings.countdownSeconds = value;
    countdownValue.textContent = value + '초';
});

// ==================== 토글 이벤트 ====================
document.getElementById('loopToggle').addEventListener('click', function() {
    this.classList.toggle('active');
    settings.loopEnabled = this.classList.contains('active');
});

document.getElementById('autoScrollToggle').addEventListener('click', function() {
    this.classList.toggle('active');
    settings.autoScrollEnabled = this.classList.contains('active');
});

document.getElementById('favoriteToggle').addEventListener('click', function() {
    this.classList.toggle('active');
    settings.favoriteMode = this.classList.contains('active');
    
    if (settings.favoriteMode) {
        document.getElementById('searchInput').value = '';
        filterFavorites();
    } else {
        isSearchMode = false;
        renderMusicList();
    }
});

// ==================== 검색 이벤트 ====================
document.getElementById('searchInput').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    filterSongs(searchTerm);
});

// ==================== 찜 기능 ====================
function toggleFavorite(songIndex, event) {
    event.stopPropagation();
    
    const songList = isSearchMode ? filteredSongs : allSongs;
    const songData = songList[songIndex];
    const songKey = `${songData.parsed.artist}-${songData.parsed.title}`;
    
    const index = favoriteSongs.indexOf(songKey);
    if (index > -1) {
        favoriteSongs.splice(index, 1);
    } else {
        favoriteSongs.push(songKey);
    }
    
    localStorage.setItem('favoriteSongs', JSON.stringify(favoriteSongs));
    
    if (settings.favoriteMode) {
        filterFavorites();
    } else if (isSearchMode) {
        filterSongs(document.getElementById('searchInput').value.toLowerCase());
    } else {
        renderMusicList();
    }
}

function isFavorite(songData) {
    const songKey = `${songData.parsed.artist}-${songData.parsed.title}`;
    return favoriteSongs.includes(songKey);
}

function filterFavorites() {
    if (!settings.favoriteMode) {
        isSearchMode = false;
        renderMusicList();
        return;
    }
    
    isSearchMode = true;
    filteredSongs = [];
    const artistMap = {};
    
    allSongs.forEach((songData, index) => {
        if (isFavorite(songData)) {
            if (!artistMap[songData.parsed.artist]) {
                artistMap[songData.parsed.artist] = [];
            }
            artistMap[songData.parsed.artist].push({...songData, originalIndex: index});
        }
    });
    
    const sortedArtists = Object.keys(artistMap).sort((a, b) => a.localeCompare(b, 'ko'));
    
    sortedArtists.forEach(artist => {
        const sortedSongs = artistMap[artist].sort((a, b) => 
            a.parsed.title.localeCompare(b.parsed.title, 'ko')
        );
        sortedSongs.forEach(songData => {
            filteredSongs.push(songData);
        });
    });
    
    let html = '<div class="artist-list">';
    if (sortedArtists.length === 0) {
        html += '<div class="loading">찜한 곡이 없습니다.</div>';
    } else {
        sortedArtists.forEach(artist => {
            html += '<div class="artist-row">';
            html += `<div class="artist-name">${artist}</div>`;
            html += '<div class="songs-container">';
            
            artistMap[artist].forEach((songData) => {
                const sheetCount = songData.sheets ? songData.sheets.length : 1;
                const sheetLabel = sheetCount > 1 ? ` (${sheetCount}장)` : '';
                const noMusicLabel = !songData.musicPath ? '⛔ ' : '';
                const songIndex = filteredSongs.indexOf(songData);
                const heartIcon = '❤️';
                
                html += `<div class="song-item" onclick="playSong(${songIndex})">
                    <span>${noMusicLabel}${songData.parsed.title}${sheetLabel}</span>
                    <span class="heart-btn" onclick="toggleFavorite(${songIndex}, event)">${heartIcon}</span>
                </div>`;
            });
            
            html += '</div></div>';
        });
    }
    html += '</div>';
    
    document.getElementById('artistList').innerHTML = html;
}

// ==================== 검색 기능 ====================
function filterSongs(searchTerm) {
    if (!searchTerm) {
        isSearchMode = false;
        renderMusicList();
        return;
    }
    
    isSearchMode = true;
    filteredSongs = [];
    const artistMap = {};
    
    allSongs.forEach((songData, index) => {
        const artistMatch = songData.parsed.artist.toLowerCase().includes(searchTerm);
        const titleMatch = songData.parsed.title.toLowerCase().includes(searchTerm);
        
        if (artistMatch || titleMatch) {
            if (!artistMap[songData.parsed.artist]) {
                artistMap[songData.parsed.artist] = [];
            }
            artistMap[songData.parsed.artist].push({...songData, originalIndex: index});
        }
    });

    const sortedArtists = Object.keys(artistMap).sort((a, b) => a.localeCompare(b, 'ko'));
    
    sortedArtists.forEach(artist => {
        const sortedSongs = artistMap[artist].sort((a, b) => 
            a.parsed.title.localeCompare(b.parsed.title, 'ko')
        );
        sortedSongs.forEach(songData => {
            filteredSongs.push(songData);
        });
    });
    
    let html = '<div class="artist-list">';
    if (sortedArtists.length === 0) {
        html += '<div class="loading">검색 결과가 없습니다.</div>';
    } else {
        sortedArtists.forEach(artist => {
            html += '<div class="artist-row">';
            html += `<div class="artist-name">${artist}</div>`;
            html += '<div class="songs-container">';
            
            artistMap[artist].forEach((songData) => {
                const sheetCount = songData.sheets ? songData.sheets.length : 1;
                const sheetLabel = sheetCount > 1 ? ` (${sheetCount}장)` : '';
                const noMusicLabel = !songData.musicPath ? '⛔ ' : '';
                const songIndex = filteredSongs.indexOf(songData);
                const heartIcon = isFavorite(songData) ? '❤️' : '🤍';
                
                html += `<div class="song-item" onclick="playSong(${songIndex})">
                    <span>${noMusicLabel}${songData.parsed.title}${sheetLabel}</span>
                    <span class="heart-btn" onclick="toggleFavorite(${songIndex}, event)">${heartIcon}</span>
                </div>`;
            });
            
            html += '</div></div>';
        });
    }
    html += '</div>';
    
    document.getElementById('artistList').innerHTML = html;
}

// ==================== 파일 로딩 ====================
async function loadFiles() {
    document.getElementById('artistList').innerHTML = '<div class="loading">파일 목록을 불러오는 중... 🎵</div>';
    
    try {
        const response = await fetch('filelist.json');
        if (!response.ok) {
            throw new Error('filelist.json 파일을 찾을 수 없습니다');
        }
        
        const filelist = await response.json();
        musicFiles = filelist.music || [];
        sheetFiles = filelist.sheets || [];
        
        if (musicFiles.length === 0 && sheetFiles.length === 0) {
            throw new Error('음악 파일과 악보 파일이 없습니다');
        }
        
        updateStatus();
        renderMusicList();
        document.getElementById('searchBar').style.display = 'block';
        
    } catch (error) {
        console.error('파일 로딩 오류:', error);
        document.getElementById('artistList').innerHTML = `
            <div class="error">
                ❌ 파일을 불러올 수 없습니다<br>
                <small>${error.message}</small><br><br>
                <small>filelist.json 파일이 있는지 확인해주세요</small>
            </div>
        `;
    }
}

function updateStatus() {
    document.getElementById('musicCount').textContent = musicFiles.length;
    document.getElementById('sheetCount').textContent = sheetFiles.length;
}

// ==================== 파일 파싱 ====================
function parseFileName(filename) {
    const nameWithoutExt = filename.split('/').pop().replace(/\.(m4a|opus|mp3|png)$/i, '');
    const nameWithoutNumber = nameWithoutExt.replace(/\s*\d+\s*$/, '');
    const parts = nameWithoutNumber.split('-');
    
    if (parts.length >= 2) {
        return {
            artist: parts[0].trim(),
            title: parts.slice(1).join('-').trim(),
            full: nameWithoutNumber
        };
    }
    return { artist: '알 수 없음', title: nameWithoutNumber, full: nameWithoutNumber };
}

function similarity(s1, s2) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(s1, s2) {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else if (j > 0) {
                let newValue = costs[j - 1];
                if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

function findMatchingMusic(sheetName) {
    const sheetParsed = parseFileName(sheetName);
    const matches = [];
    
    musicFiles.forEach(musicPath => {
        const musicParsed = parseFileName(musicPath);
        const sim = similarity(
            sheetParsed.full.toLowerCase(),
            musicParsed.full.toLowerCase()
        );
        
        if (sim > 0.6) {
            matches.push({ path: musicPath, similarity: sim });
        }
    });
    
    return matches.sort((a, b) => b.similarity - a.similarity)[0]?.path || null;
}

function findMatchingSheets(baseName) {
    const baseParsed = parseFileName(baseName);
    const matches = [];
    
    sheetFiles.forEach(sheetPath => {
        const sheetParsed = parseFileName(sheetPath);
        const sim = similarity(
            baseParsed.full.toLowerCase(),
            sheetParsed.full.toLowerCase()
        );
        
        if (sim > 0.85) {
            matches.push({ path: sheetPath, similarity: sim });
        }
    });
    
    return matches
        .sort((a, b) => b.similarity - a.similarity)
        .map(m => m.path);
}

// ==================== 목록 렌더링 ====================
function renderMusicList() {
    if (sheetFiles.length === 0) {
        document.getElementById('artistList').innerHTML = '<div class="loading">악보 파일이 없습니다.</div>';
        return;
    }

    const artistMap = {};
    const processedSheets = new Set();
    allSongs = [];
    
    sheetFiles.forEach(sheetPath => {
        const parsed = parseFileName(sheetPath);
        const baseKey = `${parsed.artist}-${parsed.title}`;
        
        if (processedSheets.has(baseKey)) {
            return;
        }
        
        processedSheets.add(baseKey);
        const allSheets = findMatchingSheets(sheetPath);
        const musicPath = findMatchingMusic(sheetPath);
        
        if (!artistMap[parsed.artist]) {
            artistMap[parsed.artist] = [];
        }
        
        const songData = { 
            sheetPath, 
            sheets: allSheets,
            parsed, 
            musicPath 
        };
        artistMap[parsed.artist].push(songData);
    });

    allSongs = [];
    const sortedArtists = Object.keys(artistMap).sort((a, b) => a.localeCompare(b, 'ko'));

    sortedArtists.forEach(artist => {
        const sortedSongs = artistMap[artist].sort((a, b) => 
            a.parsed.title.localeCompare(b.parsed.title, 'ko')
        );
        
        sortedSongs.forEach(songData => {
            allSongs.push(songData);
        });
    });      
    
    let html = '<div class="artist-list">';
    sortedArtists.forEach(artist => {
        html += '<div class="artist-row">';
        html += `<div class="artist-name">${artist}</div>`;
        html += '<div class="songs-container">';
        
        artistMap[artist].forEach((songData) => {
            const songIndex = allSongs.indexOf(songData);
            const sheetCount = songData.sheets.length;
            const sheetLabel = sheetCount > 1 ? ` (${sheetCount}장)` : '';
            const noMusicLabel = !songData.musicPath ? '⛔ ' : '';
            const heartIcon = isFavorite(songData) ? '❤️' : '🤍';
            
            html += `<div class="song-item" onclick="playSong(${songIndex})">
                <span>${noMusicLabel}${songData.parsed.title}${sheetLabel}</span>
                <span class="heart-btn" onclick="toggleFavorite(${songIndex}, event)">${heartIcon}</span>
            </div>`;
        });
        
        html += '</div></div>';
    });
    html += '</div>';
    
    document.getElementById('artistList').innerHTML = html;
}

// ==================== 재생 기능 ====================
async function playSong(songIndex) {
    currentSongIndex = songIndex;
    const songList = isSearchMode ? filteredSongs : allSongs;
    const songData = songList[songIndex];
    if (!songData) return;

    const popup = document.getElementById('popup');
    const audioPlayer = document.getElementById('audioPlayer');
    
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }
    
    popupPlaybackRate = settings.playbackRate;
    
    document.getElementById('popupTitle').textContent = `${songData.parsed.artist} - ${songData.parsed.title}`;
    document.getElementById('sheetMusicSection').innerHTML = '<div class="no-sheet">악보를 불러오는 중...</div>';
    
    popup.style.display = 'block';
    createSpeedControls();

    const sheetSection = document.getElementById('sheetMusicSection');
    sheetSection.innerHTML = '';
    sheetSection.className = 'sheet-music-section';
    
    if (songData.sheets && songData.sheets.length > 0) {
        if (songData.sheets.length === 1) {
            sheetSection.classList.add('single');
        } else {
            sheetSection.classList.add('multiple');
        }
        
        songData.sheets.forEach(sheetPath => {
            const img = document.createElement('img');
            img.src = sheetPath;
            img.alt = '악보';
            sheetSection.appendChild(img);
        });
    } else {
        sheetSection.innerHTML = '<div class="no-sheet">악보가 없습니다</div>';
    }

    if (songData.musicPath) {
        audioPlayer.src = songData.musicPath;
        audioPlayer.playbackRate = popupPlaybackRate;
        audioPlayer.style.display = 'block';
        audioPlayer.loop = false;
        currentAudio = audioPlayer;

        audioPlayer.onended = function() {
            if (countdownTimer) {
                clearInterval(countdownTimer);
                countdownTimer = null;
            }
            
            if (settings.loopEnabled) {
                const songList = isSearchMode ? filteredSongs : allSongs;
                if (currentSongIndex < songList.length - 1) {
                    playSong(currentSongIndex + 1);
                } else {
                    playSong(0);
                }
            } else {
                const sheetSection = document.getElementById('sheetMusicSection');
                sheetSection.scrollTop = 0;
                audioPlayer.currentTime = 0;
                audioPlayer.play().catch(err => {
                    console.error('재생 오류:', err);
                });
            }
        };
        
        let countdown = settings.countdownSeconds;
        document.getElementById('countdown').textContent = `${countdown}초 후 자동 재생됩니다...`;
        
        countdownTimer = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                document.getElementById('countdown').textContent = `${countdown}초 후 자동 재생됩니다...`;
            } else {
                clearInterval(countdownTimer);
                document.getElementById('countdown').textContent = '';
                audioPlayer.play();

                audioPlayer.removeEventListener('timeupdate', autoScroll);
                audioPlayer.addEventListener('timeupdate', autoScroll);

                function autoScroll() {
                    if (window.innerWidth < 768 && settings.autoScrollEnabled) {
                        const currentTime = audioPlayer.currentTime;
                        const duration = audioPlayer.duration;
                        
                        if (currentTime > 60) {
                            const adjustedProgress = (currentTime - 60) / (duration - 60);
                            const sheetSection = document.getElementById('sheetMusicSection');
                            const maxScroll = sheetSection.scrollHeight - sheetSection.clientHeight;
                            sheetSection.scrollTop = maxScroll * adjustedProgress;
                        }
                    }
                }
            }
        }, 1000);
    } else {
        audioPlayer.style.display = 'none';
        
        const songList = isSearchMode ? filteredSongs : allSongs;
        if (settings.loopEnabled && currentSongIndex < songList.length - 1) {
            let countdown = settings.countdownSeconds;
            document.getElementById('countdown').textContent = `음악 파일이 없습니다 (${countdown}초 후 다음 곡)`;
            
            countdownTimer = setInterval(() => {
                countdown--;
                if (countdown > 0) {
                    document.getElementById('countdown').textContent = `음악 파일이 없습니다 (${countdown}초 후 다음 곡)`;
                } else {
                    clearInterval(countdownTimer);
                    playSong(currentSongIndex + 1);
                }
            }, 1000);
        } else {
            document.getElementById('countdown').textContent = '음악 파일이 없습니다';
        }
    }
}

function createSpeedControls() {
    const speedControls = document.getElementById('speedControls');
    
    speedControls.innerHTML = `
        <input type="range" id="popupSpeedSlider" min="0.6" max="1.5" step="0.1" value="${popupPlaybackRate}" class="slider popup-slider">
        <span id="popupSpeedValue" class="value-display popup-value">${popupPlaybackRate.toFixed(1)}x</span>
    `;
    
    document.getElementById('popupSpeedSlider').addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        changePopupSpeed(value);
    });
}

function changePopupSpeed(speed) {
    popupPlaybackRate = speed;
    if (currentAudio) {
        currentAudio.playbackRate = speed;
    }
    const popupSpeedValue = document.getElementById('popupSpeedValue');
    if (popupSpeedValue) {
        popupSpeedValue.textContent = speed.toFixed(1) + 'x';
    }
}

function toggleFullscreen() {
    const popup = document.getElementById('popup');
    if (!document.fullscreenElement) {
        popup.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

function closePopup() {
    if (document.fullscreenElement) {
        document.exitFullscreen();
    }
    
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
    }
    if (countdownTimer) {
        clearInterval(countdownTimer);
    }
    document.getElementById('popup').style.display = 'none';
}
