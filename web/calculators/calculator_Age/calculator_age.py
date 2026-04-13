from datetime import datetime
from dateutil.relativedelta import relativedelta
import random

def calculate_age_info(birth_date_str, base_date_str="2025-02-18"):
    birth_date = datetime.strptime(birth_date_str, "%Y%m%d")
    base_date = datetime.strptime(base_date_str, "%Y-%m-%d")
    
    # 나이 계산
    age = relativedelta(base_date, birth_date)
    korean_age = base_date.year - birth_date.year + 1
    year_age = base_date.year - birth_date.year
    
    # 만 나이 계산
    if (base_date.month, base_date.day) < (birth_date.month, birth_date.day):
        year_age -= 1
    
    # 육십갑자 계산
    celestial_stems = "갑을병정무기경신임계"
    terrestrial_branches = "자축인묘진사오미신유술해"
    zodiac = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"]
    year = birth_date.year
    sexagenary_cycle = f"{celestial_stems[(year-4)%10]}{terrestrial_branches[(year-4)%12]}"
    zodiac_sign = zodiac[(year-4)%12]
    
    # 상생과 상극 계산
    zodiac_relations = {
        "쥐": {"상생": ["용", "원숭이"], "상극": ["말", "양"]},
        "소": {"상생": ["뱀", "닭"], "상극": ["호랑이", "양"]},
        "호랑이": {"상생": ["말", "개"], "상극": ["원숭이", "뱀"]},
        "토끼": {"상생": ["양", "돼지"], "상극": ["닭", "쥐"]},
        "용": {"상생": ["쥐", "원숭이"], "상극": ["개", "돼지"]},
        "뱀": {"상생": ["소", "닭"], "상극": ["호랑이", "돼지"]},
        "말": {"상생": ["호랑이", "개"], "상극": ["쥐", "소"]},
        "양": {"상생": ["토끼", "돼지"], "상극": ["쥐", "소"]},
        "원숭이": {"상생": ["쥐", "용"], "상극": ["호랑이", "돼지"]},
        "닭": {"상생": ["소", "뱀"], "상극": ["토끼", "개"]},
        "개": {"상생": ["호랑이", "말"], "상극": ["용", "닭"]},
        "돼지": {"상생": ["토끼", "양"], "상극": ["뱀", "원숭이"]}
    }
    
    compatible_signs = zodiac_relations[zodiac_sign]["상생"]
    incompatible_signs = zodiac_relations[zodiac_sign]["상극"]
    
    # 일수 계산
    days_lived = (base_date.date() - birth_date.date()).days
    
    # 연월일 계산
    years_lived = age.years
    months_lived = age.years * 12 + age.months
    days_remainder = age.days
    
    # 별자리 계산
    star_sign = get_star_sign(birth_date.month, birth_date.day)
    
    return {
        "만 나이": f"{year_age}세",
        "세는 나이(한국 나이)": f"{korean_age}살",
        "연 나이": f"{year_age + 1}세",
        "육십갑자": f"{sexagenary_cycle}년, {zodiac_sign}띠입니다.",
        "별자리": star_sign,
        "상생": f"{', '.join(compatible_signs)}",
        "상극": f"{', '.join(incompatible_signs)}",
        "일 수": f"{days_lived:,}일",
        "연월일": f"{years_lived}년 {age.months}개월 {days_remainder}일",
        "개월 수": f"{months_lived:,}개월",
        "생년월일": birth_date.strftime("%Y년 %m월 %d일 (%A)"),
        "기준일": base_date.strftime("%Y년 %m월 %d일 (%A)")
    }

def get_star_sign(month, day):
    if (month == 3 and day >= 21) or (month == 4 and day <= 19):
        return "양자리"
    elif (month == 4 and day >= 20) or (month == 5 and day <= 20):
        return "황소자리"
    elif (month == 5 and day >= 21) or (month == 6 and day <= 21):
        return "쌍둥이자리"
    elif (month == 6 and day >= 22) or (month == 7 and day <= 22):
        return "게자리"
    elif (month == 7 and day >= 23) or (month == 8 and day <= 22):
        return "사자자리"
    elif (month == 8 and day >= 23) or (month == 9 and day <= 22):
        return "처녀자리"
    elif (month == 9 and day >= 23) or (month == 10 and day <= 22):
        return "천칭자리"
    elif (month == 10 and day >= 23) or (month == 11 and day <= 21):
        return "전갈자리"
    elif (month == 11 and day >= 22) or (month == 12 and day <= 21):
        return "사수자리"
    elif (month == 12 and day >= 22) or (month == 1 and day <= 19):
        return "염소자리"
    elif (month == 1 and day >= 20) or (month == 2 and day <= 18):
        return "물병자리"
    else:
        return "물고기자리"

def generate_indian_name(birth_date):
    adjectives = ["용감한", "지혜로운", "빠른", "조용한", "강한", "날카로운", "부드러운", "신비한", "행운의", "열정적인",
                "자유로운", "창의적인", "평화로운", "활기찬", "우아한", "단단한", "유연한", "영리한", "충성스러운", "정의로운"]
    nouns = ["독수리", "늑대", "바람", "달", "호랑이", "폭풍", "산", "강", "불꽃", "나무",
            "매", "곰", "들소", "여우", "코요테", "비버", "올빼미", "사슴", "토끼", "거북이"]
    season_names = {
        "봄": ["꽃", "새싹", "나비", "진달래", "개나리", "제비"],
        "여름": ["태양", "파도", "번개", "소나기", "무지개", "매미"],
        "가을": ["단풍", "추수", "안개", "보름달", "은행", "코스모스"],
        "겨울": ["눈", "얼음", "서리", "북극성", "솔방울", "펭귄"]
    }

    birth_month = birth_date.month
    if 3 <= birth_month <= 5:
        season = "봄"
    elif 6 <= birth_month <= 8:
        season = "여름"
    elif 9 <= birth_month <= 11:
        season = "가을"
    else:
        season = "겨울"

    adj = random.choice(adjectives)
    noun = random.choice(nouns)
    season_noun = random.choice(season_names[season])

    return f"{adj} {season_noun} {noun}"

# 사용자 입력
birth_date = input("생년월일을 입력하세요 (숫자만 입력하세요): ")
birth_date_formatted = f"{birth_date[:4]}-{birth_date[4:6]}-{birth_date[6:]}"
base_date = "2025-02-18"  # 현재 날짜

# 나이 계산
result = calculate_age_info(birth_date, base_date)

# 인디언식 이름 생성
indian_name = generate_indian_name(datetime.strptime(birth_date, "%Y%m%d"))

# 결과 출력
print(f"\n입력한 생년월일: {birth_date_formatted}")
print(f"기준일 {base_date}에 대한 나이 계산 결과:")
for key, value in result.items():
    print(f"{key}: {value}")

print(f"\n당신의 별자리는 '{result['별자리']}'입니다.")
print(f"당신의 인디언식 이름은 '{indian_name}'입니다.")
