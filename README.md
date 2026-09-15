# 다이소 재고 확인기 — 배포 가이드 (코딩 지식 필요 없음)

이 폴더 전체가 완성된 웹앱입니다. 아래 순서대로 클릭만 따라 하시면 인터넷에서 접속 가능한
나만의(그리고 수강생 전용) 다이소 재고 확인기가 만들어집니다.

## 1단계. GitHub 계정 만들기
1. https://github.com 접속 → 우측 상단 "Sign up" → 이메일/비밀번호로 가입 (무료)

## 2단계. 이 코드를 GitHub에 올리기
1. 로그인 후 우측 상단 "+" 버튼 → "New repository" 클릭
2. Repository name에 `daiso-checker` 입력 → "Create repository"
3. 만들어진 빈 저장소 화면에서 "uploading an existing file" 링크 클릭
4. 이 폴더 안의 파일/폴더를 전부 그대로 끌어다 놓기(드래그 앤 드롭)
   - `package.json`, `next.config.js`, `vercel.json`, `pages` 폴더, `lib` 폴더, 이 `README.md`
   - `node_modules` 폴더가 있다면 그건 올리지 않아도 됩니다 (자동으로 다시 만들어짐)
5. 하단 "Commit changes" 버튼 클릭 → 업로드 완료

## 3단계. Vercel에 배포하기
1. https://vercel.com 접속 → "Sign Up" → **"Continue with GitHub"** 선택 (방금 만든 GitHub 계정으로 로그인)
2. 로그인 후 "Add New..." → "Project" 클릭
3. 방금 올린 `daiso-checker` 저장소를 찾아서 "Import" 클릭
4. 설정 화면에서:
   - Framework Preset: Next.js (자동으로 감지됨, 그대로 두기)
   - **"Environment Variables" 항목을 펼쳐서** 아래처럼 입력:
     - Name: `ACCESS_CODE`
     - Value: 본인과 수강생에게만 알려줄 비밀번호 (예: `2024daiso!`) — 원하는 걸로 바꿔도 됩니다
   - "Add" 클릭
5. "Deploy" 버튼 클릭 → 1~2분 기다리면 배포 완료
6. 완료 화면에 나오는 주소(예: `daiso-checker-xxxx.vercel.app`)가 이제 실제 사용할 주소입니다

이 주소를 본인 즐겨찾기에 저장하고, 수강생들에게는 주소 + 비밀번호(ACCESS_CODE에 입력한 값)를 함께 안내하시면 됩니다.

## 4단계. 실제로 써보기
1. 위 주소로 접속 → 비밀번호 입력 → 입장
2. 상품명(예: "수세미") 입력
3. 지역(예: 경기) 선택
4. "재고 확인 시작" 클릭
5. 잠시 기다리면 매장별로 재고가 있는 곳부터 순서대로 나타납니다

**주의**: 매장이 많은 지역(경기, 서울 등)은 수백 개 매장을 하나씩 확인하기 때문에
1~3분 정도 걸릴 수 있습니다. 진행 중에는 화면을 벗어나지 말고 기다려주세요.

## 나중에 비밀번호를 바꾸고 싶다면
Vercel 프로젝트 화면 → "Settings" → "Environment Variables" → `ACCESS_CODE` 값 수정 →
저장 후 "Deployments" 탭에서 가장 최근 배포 옆 "..." → "Redeploy" 클릭

## 이 앱은 어떻게 작동하나요
다이소가 공식 제공하는 API가 아니라, 다이소 파인더(daiso-finder.kr)라는
개인 개발자가 만든 무료 공개 오픈소스 API를 통해 매장 목록과 재고를 가져옵니다.
다이소 측 정책 변경으로 언젠가 응답이 안 올 수도 있습니다 — 그런 경우 화면에
"확인 불가"로 표시되니, 실제 구매 전에는 매장에 한 번 더 확인하는 걸 권장합니다.
