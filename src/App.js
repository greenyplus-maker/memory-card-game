import { useState, useEffect, useRef } from "react";

const SUPABASE_URL = "https://vqjfmkbsrgvrnyrnwkul.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxamZta2Jzcmd2cm55cm53a3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzA5NDgsImV4cCI6MjA4ODY0Njk0OH0.eWrx_EqPE9M1TkScTrV-YFV-IVakPOocj6cYaDa7Veg";

async function supabaseApi(method, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/leaderboard`, {
    method,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": method === "POST" ? "return=minimal" : "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (method === "GET") return res.json();
}

function useSounds() {
  const ctxRef = useRef(null);
  function ctx() {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return ctxRef.current;
  }
  function tone(ac, freq, freq2, dur, vol, wave) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type = wave || "square";
    o.frequency.setValueAtTime(freq, ac.currentTime);
    if (freq2) o.frequency.linearRampToValueAtTime(freq2, ac.currentTime + dur);
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.start(ac.currentTime); o.stop(ac.currentTime + dur);
  }
  return {
    flip()  { const ac = ctx(); tone(ac, 300, 520, 0.07, 0.18); },
    fail()  { const ac = ctx(); tone(ac, 380, 140, 0.22, 0.22, "sawtooth"); },
    match() {
      const ac = ctx();
      [[523,0],[659,.1],[784,.2]].forEach(([f,t]) => {
        const o=ac.createOscillator(),g=ac.createGain();
        o.connect(g);g.connect(ac.destination);o.type="square";
        o.frequency.setValueAtTime(f,ac.currentTime+t);
        g.gain.setValueAtTime(0.22,ac.currentTime+t);
        g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+t+0.12);
        o.start(ac.currentTime+t);o.stop(ac.currentTime+t+0.13);
      });
    },
    clear() {
      const ac = ctx();
      [[523,0,.1],[523,.12,.1],[523,.24,.1],[523,.36,.1],[659,.48,.1],[784,.6,.1],[1047,.76,.45]].forEach(([f,t,d]) => {
        const o=ac.createOscillator(),g=ac.createGain();
        o.connect(g);g.connect(ac.destination);o.type="square";
        o.frequency.setValueAtTime(f,ac.currentTime+t);
        g.gain.setValueAtTime(0.25,ac.currentTime+t);
        g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+t+d);
        o.start(ac.currentTime+t);o.stop(ac.currentTime+t+d);
      });
    },
  };
}

const DIFF = {
  easy:   { label:"쉬움",   emoji:"🟢", cols:4, pairs:8,  delay:1000, color:"#4ade80", desc:"8쌍 · 1초 기억" },
  normal: { label:"보통",   emoji:"🟡", cols:4, pairs:10, delay:700,  color:"#fbbf24", desc:"10쌍 · 0.7초" },
  hard:   { label:"어려움", emoji:"🔴", cols:4, pairs:12, delay:400,  color:"#f87171", desc:"12쌍 · 0.4초" },
};
const ALL_EMOJIS = ["🐶","🐱","🦊","🐸","🦋","🌸","🍭","⭐","🎸","🍕","🚀","🦄"];
const MEDAL = ["🥇","🥈","🥉"];

function shuffle(arr) {
  return [...arr].map(v=>({v,r:Math.random()})).sort((a,b)=>a.r-b.r).map(x=>x.v);
}
function fmt(s) {
  return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
}

// 글라스 카드 공통 스타일
const glass = {
  background: "rgba(255,255,255,0.15)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: 20,
  boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
};

const glassStrong = {
  background: "rgba(255,255,255,0.22)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.4)",
  borderRadius: 24,
  boxShadow: "0 8px 40px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.5)",
};

export default function App() {
  const [screen, setScreen]     = useState("setup");
  const [nick, setNick]         = useState("");
  const [nickIn, setNickIn]     = useState("");
  const [diff, setDiff]         = useState("easy");
  const [muted, setMuted]       = useState(false);
  const [cards, setCards]       = useState([]);
  const [flipped, setFlipped]   = useState([]);
  const [matched, setMatched]   = useState([]);
  const [moves, setMoves]       = useState(0);
  const [won, setWon]           = useState(false);
  const [shake, setShake]       = useState([]);
  const [time, setTime]         = useState(0);
  const [running, setRunning]   = useState(false);
  const timerRef                = useRef(null);
  const [lb, setLb]             = useState([]);
  const [lbLoading, setLbLoad]  = useState(false);
  const [lbDiff, setLbDiff]     = useState("easy");

  const sfx = useSounds();
  const play = name => { if (!muted) sfx[name](); };

  async function loadLb(d = lbDiff) {
    setLbLoad(true);
    try {
      const rows = await supabaseApi("GET");
      setLb(
        rows.filter(e => e.difficulty === d)
          .sort((a,b) => a.time - b.time || a.moves - b.moves)
          .slice(0, 10)
      );
    } catch(e) {}
    setLbLoad(false);
  }

  async function saveLb(t, m) {
    await supabaseApi("POST", {
      nickname: nick, difficulty: diff,
      time: t, moves: m,
      date: new Date().toLocaleDateString("ko-KR"),
    });
  }

  function initGame(d = diff) {
    clearInterval(timerRef.current);
    const emojis = shuffle(ALL_EMOJIS).slice(0, DIFF[d].pairs);
    setCards(shuffle([...emojis,...emojis]).map((val,i)=>({id:i,val})));
    setFlipped([]); setMatched([]); setMoves(0);
    setWon(false); setShake([]);
    setTime(0); setRunning(false);
  }

  useEffect(()=>{ if(screen==="game") initGame(); }, [screen]); // eslint-disable-line
  useEffect(()=>{ if(screen==="leaderboard") loadLb(lbDiff); }, [screen, lbDiff]); // eslint-disable-line
  useEffect(()=>{
    if(running) timerRef.current = setInterval(()=>setTime(t=>t+1),1000);
    else clearInterval(timerRef.current);
    return ()=>clearInterval(timerRef.current);
  }, [running]);

  async function handleFlip(card) {
    if (!running && !won) setRunning(true);
    if (flipped.length===2||flipped.find(c=>c.id===card.id)||matched.includes(card.val)) return;
    play("flip");
    const nf = [...flipped, card];
    setFlipped(nf);
    if (nf.length===2) {
      setMoves(m=>m+1);
      if (nf[0].val===nf[1].val) {
        const nm = [...matched, card.val];
        setMatched(nm); setFlipped([]);
        if (nm.length===DIFF[diff].pairs) {
          setRunning(false); setWon(true);
          play("clear");
          await saveLb(time, moves+1);
          await loadLb(diff);
        } else { play("match"); }
      } else {
        play("fail");
        setShake(nf.map(c=>c.id));
        setTimeout(()=>{ setFlipped([]); setShake([]); }, DIFF[diff].delay);
      }
    }
  }

  const isFlipped = card => flipped.find(c=>c.id===card.id)||matched.includes(card.val);
  const cfg = DIFF[diff];
  const tColor = time<30?"#16a34a":time<60?"#d97706":"#dc2626";

  // ════════════════════════════════════════════════
  // 화면 1: 설정
  // ════════════════════════════════════════════════
  if (screen==="setup") return (
    <Wrap>
      <div style={{ textAlign:"center", maxWidth:400, width:"100%", animation:"fadeUp .5s ease" }}>
        <div style={{ fontSize:"4rem", marginBottom:8, filter:"drop-shadow(0 4px 16px rgba(99,102,241,.4))" }}>🃏</div>
        <h1 style={{ fontSize:"2.8rem", margin:"0 0 6px", ...F,
          background:"linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
          기억력 게임
        </h1>
        <p style={{ color:"rgba(255,255,255,.7)", ...N, fontSize:".95rem", marginBottom:28 }}>
          카드를 뒤집어 같은 쌍을 모두 찾아보세요!
        </p>

        {/* 닉네임 입력 */}
        <div style={{ ...glassStrong, padding:"6px 16px", marginBottom:16,
          display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:"1.2rem" }}>👤</span>
          <input value={nickIn} onChange={e=>setNickIn(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"&&nickIn.trim()){ setNick(nickIn.trim()); setScreen("game"); }}}
            placeholder="닉네임을 입력하세요" maxLength={12}
            style={{ flex:1, padding:"10px 4px", background:"transparent",
              border:"none", color:"#fff", fontSize:"1rem", ...N, outline:"none" }}
          />
        </div>

        {/* 난이도 선택 */}
        <p style={{ color:"rgba(255,255,255,.5)", ...N, fontSize:".8rem",
          marginBottom:10, textAlign:"left" }}>▸ 난이도 선택</p>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:24 }}>
          {Object.entries(DIFF).map(([key,d])=>(
            <div key={key} onClick={()=>setDiff(key)} style={{
              ...glass,
              display:"flex", alignItems:"center", gap:14, padding:"14px 18px",
              cursor:"pointer",
              background: diff===key ? `rgba(255,255,255,0.28)` : "rgba(255,255,255,0.12)",
              border: `1px solid ${diff===key ? "rgba(255,255,255,.6)" : "rgba(255,255,255,.2)"}`,
              boxShadow: diff===key ? `0 8px 32px ${d.color}40, inset 0 1px 0 rgba(255,255,255,.5)` : "0 4px 16px rgba(0,0,0,.08)",
              transition:"all .2s",
            }}>
              <span style={{ fontSize:"1.6rem" }}>{d.emoji}</span>
              <div style={{ flex:1, textAlign:"left" }}>
                <div style={{ color: diff===key ? d.color : "rgba(255,255,255,.9)", ...F, fontSize:"1rem" }}>{d.label}</div>
                <div style={{ color:"rgba(255,255,255,.5)", ...N, fontSize:".75rem" }}>{d.desc}</div>
              </div>
              <div style={{ width:22, height:22, borderRadius:"50%",
                background: diff===key ? d.color : "rgba(255,255,255,.2)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:".7rem", color:"#fff", transition:"all .2s" }}>
                {diff===key && "✓"}
              </div>
            </div>
          ))}
        </div>

        <button onClick={()=>{ if(nickIn.trim()){ setNick(nickIn.trim()); setScreen("game"); }}}
          disabled={!nickIn.trim()}
          style={{ ...BtnPrimary, width:"100%", marginBottom:10, opacity:nickIn.trim()?1:.4 }}>
          🎮 게임 시작
        </button>
        <button onClick={()=>{ setLbDiff(diff); setScreen("leaderboard"); }}
          style={{ ...BtnGlass, width:"100%" }}>
          🏆 리더보드 보기
        </button>
      </div>
      <CSS/>
    </Wrap>
  );

  // ════════════════════════════════════════════════
  // 화면 2: 게임
  // ════════════════════════════════════════════════
  if (screen==="game") return (
    <Wrap>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
        width:"100%", maxWidth:460, marginBottom:12 }}>
        <button onClick={()=>setScreen("setup")} style={BtnMini}>← 나가기</button>
        <div style={{ display:"flex", gap:6 }}>
          <span style={{ ...glass, color:cfg.color, ...N, fontSize:".82rem",
            padding:"5px 14px", borderRadius:20 }}>{cfg.emoji} {cfg.label}</span>
          <button onClick={()=>setMuted(m=>!m)} style={{ ...BtnMini, fontSize:"1rem" }}>
            {muted?"🔇":"🔊"}
          </button>
        </div>
        <button onClick={()=>{ setLbDiff(diff); setScreen("leaderboard"); }} style={BtnMini}>🏆 순위</button>
      </div>

      <h1 style={{ fontSize:"clamp(1.8rem,5vw,2.6rem)", margin:"0 0 4px", ...F,
        background:"linear-gradient(135deg,#6366f1,#8b5cf6,#ec4899)",
        WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
        🃏 기억력 게임
      </h1>
      <p style={{ color:"rgba(255,255,255,.5)", ...N, fontSize:".82rem", margin:"0 0 18px" }}>
        👤 {nick}
      </p>

      {/* 스탯 */}
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap", justifyContent:"center" }}>
        {[
          {label:"⏱️ 시간", val:fmt(time), color:tColor},
          {label:"시도",    val:moves,     color:"#8b5cf6"},
          {label:"찾은 쌍", val:`${matched.length}/${cfg.pairs}`, color:"#8b5cf6"},
        ].map(({label,val,color})=>(
          <div key={label} style={{ ...glass, padding:"10px 22px", textAlign:"center", minWidth:85 }}>
            <div style={{ fontSize:"1.4rem", color, ...F }}>{val}</div>
            <div style={{ fontSize:".68rem", color:"rgba(255,255,255,.5)", ...N }}>{label}</div>
          </div>
        ))}
      </div>

      {/* 카드 그리드 */}
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${cfg.cols},1fr)`,
        gap:cfg.pairs>8?8:10, maxWidth:cfg.pairs>10?420:cfg.pairs>8?395:365 }}>
        {cards.map(card => {
          const face = isFlipped(card);
          const isMatch = matched.includes(card.val);
          const sz = cfg.pairs<=8?76:cfg.pairs<=10?68:61;
          return (
            <div key={card.id} onClick={()=>handleFlip(card)}
              style={{ width:sz, height:sz, perspective:700, cursor:face?"default":"pointer",
                animation:shake.includes(card.id)?"shake .45s ease":isMatch?"pop .35s ease":"none" }}>
              <div style={{ width:"100%", height:"100%", position:"relative",
                transformStyle:"preserve-3d", transition:"transform .4s cubic-bezier(.34,1.56,.64,1)",
                transform:face?"rotateY(180deg)":"rotateY(0)" }}>
                {/* 뒷면 - 글라스 */}
                <div style={{ ...CF,
                  background:"rgba(255,255,255,0.18)",
                  backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
                  border:"1px solid rgba(255,255,255,0.35)",
                  boxShadow:"0 4px 16px rgba(99,102,241,.2), inset 0 1px 0 rgba(255,255,255,.4)",
                  borderRadius:16, fontSize:"1.4rem" }}>✨</div>
                {/* 앞면 - 글라스 */}
                <div style={{ ...CF, transform:"rotateY(180deg)", borderRadius:16,
                  background: isMatch
                    ? "rgba(74,222,128,0.25)"
                    : "rgba(139,92,246,0.25)",
                  backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
                  border:`1px solid ${isMatch?"rgba(74,222,128,.6)":"rgba(255,255,255,.3)"}`,
                  boxShadow: isMatch
                    ? "0 0 20px rgba(74,222,128,.3), inset 0 1px 0 rgba(255,255,255,.4)"
                    : "0 4px 16px rgba(0,0,0,.1), inset 0 1px 0 rgba(255,255,255,.3)",
                  fontSize:cfg.pairs<=8?"2rem":"1.6rem" }}>
                  {card.val}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 승리 배너 */}
      {won && (
        <div style={{ ...glassStrong, marginTop:24, textAlign:"center",
          padding:"24px 36px", animation:"fadeUp .5s ease",
          background:"rgba(255,255,255,.2)" }}>
          <div style={{ fontSize:"2.8rem", marginBottom:6 }}>🎉</div>
          <p style={{ fontSize:"1.3rem", margin:"0 0 4px", ...F,
            background:"linear-gradient(135deg,#fbbf24,#f59e0b)",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            클리어! {fmt(time)} · {moves}번 시도
          </p>
          <p style={{ color:"rgba(255,255,255,.6)", ...N, fontSize:".82rem", margin:"0 0 16px" }}>
            {cfg.emoji} {cfg.label} 난이도
          </p>
          <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
            <button onClick={()=>{ setLbDiff(diff); setScreen("leaderboard"); }} style={BtnPrimary}>🏆 리더보드</button>
            <button onClick={()=>initGame(diff)} style={BtnGlass}>🔄 재도전</button>
          </div>
        </div>
      )}
      {!won && <button onClick={()=>initGame(diff)} style={{ ...BtnGlass, marginTop:18 }}>🔄 다시 하기</button>}
      <CSS/>
    </Wrap>
  );

  // ════════════════════════════════════════════════
  // 화면 3: 리더보드
  // ════════════════════════════════════════════════
  return (
    <Wrap>
      <div style={{ width:"100%", maxWidth:460, animation:"fadeUp .4s ease" }}>
        <button onClick={()=>setScreen(nick?"game":"setup")} style={{ ...BtnMini, marginBottom:16 }}>
          ← 돌아가기
        </button>
        <h1 style={{ fontSize:"2.2rem", margin:"0 0 4px", ...F, textAlign:"center",
          background:"linear-gradient(135deg,#fbbf24,#f59e0b)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
          🏆 리더보드
        </h1>
        <p style={{ color:"rgba(255,255,255,.5)", ...N, fontSize:".82rem",
          textAlign:"center", marginBottom:16 }}>전체 TOP 10 · 난이도별 기록</p>

        {/* 난이도 탭 */}
        <div style={{ display:"flex", gap:8, marginBottom:20, justifyContent:"center" }}>
          {Object.entries(DIFF).map(([key,d])=>(
            <button key={key} onClick={()=>setLbDiff(key)}
              style={{ padding:"8px 18px", borderRadius:20, cursor:"pointer",
                ...F, fontSize:".85rem", transition:"all .2s",
                background: lbDiff===key ? `rgba(255,255,255,.28)` : "rgba(255,255,255,.1)",
                border: `1px solid ${lbDiff===key?"rgba(255,255,255,.6)":"rgba(255,255,255,.2)"}`,
                color: lbDiff===key ? d.color : "rgba(255,255,255,.6)",
                backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
                boxShadow: lbDiff===key ? `0 4px 20px ${d.color}40` : "none" }}>
              {d.emoji} {d.label}
            </button>
          ))}
        </div>

        {lbLoading ? (
          <div style={{ ...glass, color:"rgba(255,255,255,.6)", textAlign:"center",
            ...N, padding:48 }}>
            <div style={{ fontSize:"2rem", marginBottom:8 }}>⏳</div>불러오는 중...
          </div>
        ) : lb.length===0 ? (
          <div style={{ ...glass, color:"rgba(255,255,255,.6)", textAlign:"center",
            ...N, padding:48 }}>
            <div style={{ fontSize:"2.5rem", marginBottom:8 }}>🎯</div>
            아직 기록이 없어요!<br/>첫 번째 주인공이 되어보세요
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {lb.map((e,i)=>{
              const isMe = e.nickname===nick;
              return (
                <div key={i} style={{
                  ...glass,
                  display:"flex", alignItems:"center", gap:12, padding:"13px 18px",
                  animation:`fadeUp .35s ease ${i*.06}s both`,
                  background: isMe ? "rgba(251,191,36,.2)" : "rgba(255,255,255,.12)",
                  border: `1px solid ${isMe?"rgba(251,191,36,.5)":"rgba(255,255,255,.2)"}`,
                  boxShadow: isMe ? "0 4px 20px rgba(251,191,36,.2), inset 0 1px 0 rgba(255,255,255,.3)" : "0 4px 16px rgba(0,0,0,.08)",
                }}>
                  <div style={{ fontSize:i<3?"1.7rem":"1.1rem", minWidth:34,
                    textAlign:"center", ...F }}>
                    {i<3?MEDAL[i]:`${i+1}`}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ color: isMe?"#fbbf24":"rgba(255,255,255,.9)", ...F, fontSize:".95rem" }}>
                      {e.nickname}{isMe&&<span style={{ fontSize:".72rem", marginLeft:6, opacity:.8 }}>← 나</span>}
                    </div>
                    <div style={{ color:"rgba(255,255,255,.4)", ...N, fontSize:".7rem" }}>{e.date}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:"#4ade80", ...F, fontSize:"1.1rem" }}>{fmt(e.time)}</div>
                    <div style={{ color:"rgba(255,255,255,.4)", ...N, fontSize:".7rem" }}>{e.moves}번 시도</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <button onClick={()=>setScreen("game")} style={{ ...BtnPrimary, width:"100%", marginTop:20 }}>
          🎮 게임 하기
        </button>
      </div>
      <CSS/>
    </Wrap>
  );
}

// ══════════════════════════════════════════════
// 🎨 공통 스타일
// ══════════════════════════════════════════════
const F = { fontFamily:"'Fredoka One',cursive" };
const N = { fontFamily:"'Nunito',sans-serif" };

const Wrap = ({children}) => (
  <div style={{ minHeight:"100vh", padding:"20px",
    background:"linear-gradient(135deg, #667eea 0%, #764ba2 30%, #f093fb 60%, #4facfe 100%)",
    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
    ...F, position:"relative", overflow:"hidden" }}>
    {/* 배경 블러 오브 */}
    <div style={{ position:"fixed", width:400, height:400, borderRadius:"50%",
      background:"rgba(255,255,255,.08)", top:-100, left:-100,
      filter:"blur(60px)", pointerEvents:"none" }}/>
    <div style={{ position:"fixed", width:300, height:300, borderRadius:"50%",
      background:"rgba(255,255,255,.1)", bottom:-50, right:-50,
      filter:"blur(50px)", pointerEvents:"none" }}/>
    <div style={{ position:"relative", zIndex:1, width:"100%",
      display:"flex", flexDirection:"column", alignItems:"center" }}>
      <link href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;700&display=swap" rel="stylesheet"/>
      {children}
    </div>
  </div>
);

const CF = { position:"absolute", width:"100%", height:"100%",
  backfaceVisibility:"hidden",
  display:"flex", alignItems:"center", justifyContent:"center" };

const BtnPrimary = { padding:"12px 28px", borderRadius:50, cursor:"pointer",
  background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
  color:"#fff", border:"1px solid rgba(255,255,255,.3)", fontSize:"1rem", ...F,
  boxShadow:"0 4px 20px rgba(99,102,241,.4), inset 0 1px 0 rgba(255,255,255,.3)",
  backdropFilter:"blur(8px)", transition:"transform .15s, opacity .15s" };

const BtnGlass = { padding:"11px 26px", borderRadius:50, cursor:"pointer",
  background:"rgba(255,255,255,.18)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
  border:"1px solid rgba(255,255,255,.35)", color:"#fff", fontSize:".95rem", ...F,
  boxShadow:"0 4px 16px rgba(0,0,0,.1), inset 0 1px 0 rgba(255,255,255,.4)",
  transition:"all .15s" };

const BtnMini = { padding:"7px 16px", borderRadius:20, cursor:"pointer",
  background:"rgba(255,255,255,.18)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
  border:"1px solid rgba(255,255,255,.3)", color:"rgba(255,255,255,.9)",
  fontSize:".82rem", ...N,
  boxShadow:"inset 0 1px 0 rgba(255,255,255,.3)" };

const CSS = () => <style>{`
  @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
  @keyframes pop{0%{transform:scale(1)}45%{transform:scale(1.2)}100%{transform:scale(1)}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  input::placeholder{color:rgba(255,255,255,.4)}
  button:hover{transform:scale(1.04)!important;opacity:.95}
`}</style>;