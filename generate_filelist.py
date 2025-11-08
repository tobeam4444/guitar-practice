import os
import json
from pathlib import Path

def levenshtein_distance(s1, s2):
    """두 문자열 간의 편집 거리 계산"""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    
    if len(s2) == 0:
        return len(s1)
    
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    
    return previous_row[-1]

def similarity(s1, s2):
    """두 문자열의 유사도 계산 (0.0 ~ 1.0)"""
    longer = s1 if len(s1) > len(s2) else s2
    shorter = s2 if len(s1) > len(s2) else s1
    
    if len(longer) == 0:
        return 1.0
    
    edit_distance = levenshtein_distance(longer, shorter)
    return (len(longer) - edit_distance) / len(longer)

def parse_sheet_filename(filename):
    """악보 파일명 파싱: 가수 - 곡명1.png 형식"""
    # 확장자 제거
    name_without_ext = filename.replace('.png', '').replace('.jpg', '').replace('.jpeg', '')
    
    # 뒤의 숫자 제거 (1, 2, 3 등)
    name_without_number = name_without_ext.rstrip('0123456789').strip()
    
    # - 기준으로 가수/곡명 분리
    if ' - ' in name_without_number:
        parts = name_without_number.split(' - ', 1)
        artist = parts[0].strip()
        title = parts[1].strip()
    else:
        artist = '알 수 없음'
        title = name_without_number
    
    return {
        'artist': artist,
        'title': title,
        'full': name_without_number
    }

def parse_music_filename(filename):
    """음악 파일명 파싱: 전체 파일명 사용"""
    # 확장자 제거
    name_without_ext = filename.replace('.m4a', '').replace('.opus', '').replace('.mp3', '').replace('.wav', '')
    
    return {
        'full': name_without_ext.strip()
    }

def find_matching_music(sheet_name, music_files):
    """악보에 매칭되는 음악 파일 찾기 (유사도 60% 이상)"""
    sheet_parsed = parse_sheet_filename(sheet_name)
    best_match = None
    best_similarity = 0.0
    
    for music_file in music_files:
        music_name = Path(music_file).name
        music_parsed = parse_music_filename(music_name)
        
        # 전체 파일명으로 유사도 비교
        sim = similarity(
            sheet_parsed['full'].lower(),
            music_parsed['full'].lower()
        )
        
        if sim > best_similarity and sim >= 0.6:
            best_similarity = sim
            best_match = music_file
    
    return best_match, best_similarity

def group_sheets_by_song(sheet_files):
    """같은 곡의 악보들을 그룹화 (숫자만 다른 경우)"""
    groups = {}
    
    for sheet_file in sheet_files:
        sheet_name = Path(sheet_file).name
        parsed = parse_sheet_filename(sheet_name)
        base_key = f"{parsed['artist']}|{parsed['title']}"
        
        if base_key not in groups:
            groups[base_key] = {
                'artist': parsed['artist'],
                'title': parsed['title'],
                'full': parsed['full'],
                'sheets': []
            }
        
        groups[base_key]['sheets'].append(sheet_file)
    
    return groups

def generate_filelist():
    """음악 파일과 악보 파일 목록을 JSON으로 생성"""
    
    # 1. 파일 수집
    music_files = []
    sheet_files = []
    
    music_dir = Path("music")
    if music_dir.exists() and music_dir.is_dir():
        for file in music_dir.iterdir():
            if file.is_file() and file.suffix.lower() in ['.m4a', '.opus', '.mp3', '.wav']:
                music_files.append(f"music/{file.name}")
    
    sheets_dir = Path("sheets")
    if sheets_dir.exists() and sheets_dir.is_dir():
        for file in sheets_dir.iterdir():
            if file.is_file() and file.suffix.lower() in ['.png', '.jpg', '.jpeg']:
                sheet_files.append(f"sheets/{file.name}")
    
    # 2. 악보 그룹화 (같은 곡의 여러 페이지)
    sheet_groups = group_sheets_by_song(sheet_files)
    
    # 3. 매칭 정보 생성
    matched_songs = []
    unmatched_sheets = []
    
    print("=" * 60)
    print("🎵 음악-악보 매칭 시작...")
    print("=" * 60)
    
    for base_key, group_info in sheet_groups.items():
        # 각 악보 그룹에 대해 음악 파일 찾기
        matched_music, sim = find_matching_music(
            Path(group_info['sheets'][0]).name,
            music_files
        )
        
        if matched_music:
            matched_songs.append({
                'artist': group_info['artist'],
                'title': group_info['title'],
                'music': matched_music,
                'sheets': sorted(group_info['sheets']),
                'similarity': round(sim * 100, 1)
            })
            print(f"✅ [{group_info['artist']}] {group_info['title']}")
            print(f"   음악: {Path(matched_music).name} (유사도: {round(sim * 100, 1)}%)")
            print(f"   악보: {len(group_info['sheets'])}장")
        else:
            unmatched_sheets.append({
                'artist': group_info['artist'],
                'title': group_info['title'],
                'sheets': sorted(group_info['sheets'])
            })
            print(f"⚠️  [{group_info['artist']}] {group_info['title']}")
            print(f"   매칭되는 음악 파일 없음 (유사도 60% 미만)")
            print(f"   악보: {len(group_info['sheets'])}장")
    
    # 4. JSON 파일 생성
    output_data = {
        'music': sorted(music_files),
        'sheets': sorted(sheet_files),
        'matched_songs': sorted(matched_songs, key=lambda x: (x['artist'], x['title'])),
        'unmatched_sheets': sorted(unmatched_sheets, key=lambda x: (x['artist'], x['title']))
    }
    
    with open('filelist.json', 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    # 5. 결과 출력
    print("\n" + "=" * 60)
    print("✅ filelist.json 생성 완료!")
    print("=" * 60)
    print(f"🎵 전체 음악 파일: {len(music_files)}개")
    print(f"📄 전체 악보 파일: {len(sheet_files)}개")
    print(f"✅ 매칭 성공: {len(matched_songs)}곡")
    print(f"⚠️  매칭 실패: {len(unmatched_sheets)}곡")
    print("=" * 60)
    
    if unmatched_sheets:
        print("\n⚠️  매칭되지 않은 악보:")
        for item in unmatched_sheets[:5]:
            print(f"  - [{item['artist']}] {item['title']}")
        if len(unmatched_sheets) > 5:
            print(f"  ... 외 {len(unmatched_sheets) - 5}개")
    
    print("\n" + "=" * 60)
    
    return output_data

if __name__ == "__main__":
    try:
        generate_filelist()
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
