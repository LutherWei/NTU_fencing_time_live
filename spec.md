# 擊劍比賽計分系統SPEC
**你現在要實作一個網頁，這個網頁和fencing time live一樣，是一個可以提供擊劍比賽分數、進度資訊的平台，使用者是台大擊劍隊的所有隊員。所有實作內容可以參考 https://git.launchpad.net/bellepoule ，但是實作部分以以下為主**
## 1. 登入
雖然所有進入該url的人都可以看分數，但是幫我實作一個admin登入的地方，只有登入的admin可以編輯、更改分數。
## 2. 選手檢錄
這裡可以讓admin自由編輯（插入、移除...）組別（例如男子鈍劍、女子鈍劍、男子軍刀等等，但組名可以由admin自行決定），以及歸類參賽選手。每個組別的進度要獨立管理，例如：男子鈍劍的選手如果已經檢錄完畢，可以自行進入分組賽與後續環節，不用等待女子鈍劍選手。
## 3. 分組預賽
這部分可以先讓admin自行分組，但需要遵守以下規則：
- 人數：每一組最少4人，最多8人。
- 分數登記：確定分組後，每一組要有一個(n+1)*(n+1)的表格讓admin自由上表格登記分數。每個選手的row代表該選手對每個選手的得分，例如form[3][4]就是第三位選手隊第四位選手的得分，而form[i][i]永遠無法填寫，要用X或是黑色格子代替，因為自己不會在自己身上得分。每一場預賽打5分，拿到5分的選手在該格內記為V，如果比數為4:3則直接計阿拉伯數字。對於每個對決form[i][j] and form[j][i]，需要在贏的那格渲染綠色，輸的那格渲染紅色
- 存檔：小組賽表格的每個表個填寫完畢後，需要存檔並計算每個人的得分（row總和）、失分（column總和）、淨得失分（sum(row[i]) - sum(column[i])）、勝場、勝率
## 4. 淘汰賽
- 排名：所有組別選手的排名依序比較勝率、淨得分、得分，若有選手三項都相同則隨機決定名次。如果如果涉及晉級資格時，一律晉級。
- 淘汰比率：再決定排名後，admin可以自行決定「淘汰比率」以及「是否進決定三四名」，接著系統才render樹狀圖。
- 樹狀圖：比賽採取單淘替制，根據晉級人數n決定要從$2^{\lceil \log_2n \rceil}$強打起，對站組合依照出賽排名最大亂度決定，意即在第x強的比賽都是由排名第x+1-y的選手對上排名y的選手，若低排名的選手打贏高排名的選手則要和高排名選手互換排名。
- 登記分數：admin只要對於每一場比賽登記分數，系統就要自動決定誰晉級，並在網頁圖像上顯示出來。
## 總排名
根據淘汰賽結果輸出比賽總排名

## 架構：
fencing-score-system/
├── prisma/                     # 資料庫相關
│   └── schema.prisma           # 定義 Fencer, Category, Match, Poule 等資料表結構
├── src/
│   ├── app/                    # Next.js App Router (處理路由與頁面)
│   │   ├── (public)/           # 公開頁面 (免登入即可觀看)
│   │   │   ├── page.tsx        # 首頁：顯示目前所有進行中的組別與最新賽況
│   │   │   └── results/
│   │   │       └── [categoryId]/
│   │   │           └── page.tsx # 單一組別的完整結果 (預賽成績、淘汰賽樹狀圖)
│   │   ├── admin/              # 管理員後台 (受保護的路由)
│   │   │   ├── layout.tsx      # 後台專屬 Layout (包含側邊導覽列)
│   │   │   ├── login/          # 管理員登入頁面
│   │   │   │   └── page.tsx
│   │   │   ├── dashboard/      # 後台總覽
│   │   │   │   └── page.tsx
│   │   │   ├── check-in/       # 2. 選手檢錄與組別管理
│   │   │   │   └── page.tsx
│   │   │   ├── poules/         # 3. 分組預賽管理 (填寫 Matrix)
│   │   │   │   └── [categoryId]/page.tsx
│   │   │   └── bracket/        # 4. 淘汰賽管理 (淘汰比率設定、樹狀圖分數登記)
│   │   │       └── [categoryId]/page.tsx
│   │   └── api/                # 後端 API 路由 (如果不用 Server Actions 的話)
│   │       ├── auth/           # 處理登入驗證
│   │       ├── categories/     # CRUD 組別
│   │       └── matches/        # 更新比賽分數
│   │
│   ├── components/             # 可共用的 React 元件
│   │   ├── ui/                 # 通用基礎元件 (按鈕、輸入框、Modal 等)
│   │   ├── poules/
│   │   │   └── PouleMatrix.tsx # 小組賽計分方陣圖 (處理對角線變黑、勝負變色)
│   │   ├── bracket/
│   │   │   ├── BracketTree.tsx # 淘汰賽樹狀圖渲染元件
│   │   │   └── MatchNode.tsx   # 樹狀圖上的單一比賽節點 (可點擊輸入分數)
│   │   └── layout/
│   │       └── Navbar.tsx      # 頂部導覽列
│   │
│   ├── lib/                    # 核心業務邏輯與工具函式 (非常重要！)
│   │   ├── prisma.ts           # 實體化 Prisma Client
│   │   ├── fencing-math.ts     # 處理勝率、淨得分(Ind)、總得分(HS) 的演算法
│   │   ├── bracket-gen.ts      # 處理 2^n 強最大亂度排程、輪空(Bye) 的演算法
│   │   └── utils.ts            # 其他通用工具 (如 Tailwind class 合併)
│   │
│   └── types/                  # TypeScript 型別定義
│       └── fencing.d.ts        # 定義選手、比賽狀態的 interface
│
├── .env                        # 環境變數 (資料庫連線字串、JWT Secret 等)
├── package.json
├── tailwind.config.ts
└── tsconfig.json