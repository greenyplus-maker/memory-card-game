import { useState, useEffect, useRef } from "react";

// ══════════════════════════════════════════════
// 🔊 8bit 효과음 엔진
// ══════════════════════════════════════════════
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

// ══════════════════════════════════════════════
// ⚙️ 설정 & 상수
// ══════════════════════════════════════════════
const DIFF = {
  easy:   { label:"쉬움",   emoji:"🟢", cols:4, pairs:8,  delay:1000, color:"#34d399", desc:"8쌍 · 1초 기억" },
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

// ══════════════════════════════════════════════
// 🎮 메인 앱
// ══════════════════════════════════════════════
export default function App() {
  const [screen, setScreen]     = useState("setup");
  const [nick, setNick]         = useState("");
  const [nickIn, setNickIn]     = useState("");
  const [diff, setDiff]         = useState("easy");
  const [muted, setMuted]       = useState(false);

  // 게임 상태
  const [cards, setCards]       = useState([]);
  const [flipped, setFlipped]   = useState([]);
  const [matched, setMatched]   = useState([]);
  const [moves, setMoves]       = useState(0);
  const [won, setWon]           = useState(false);
  const [shake, setShake]       = useState([]);

  // 타이머
  const [time, setTime]         = useState(0);
  const [running, setRunning]   = useState(false);
  const timerRef                = useRef(null);

  // 리더보드
  const [lb, setLb]             = useState([]);
  const [lbLoading, setLbLoad]  = useState(false);
  const [lbDiff, setLbDiff]     = useState("easy");

  const sfx = useSounds();
  const play = name => { if (!muted) sfx[name](); };

  // ── 리더보드 ────────────────────────────────
  async function loadLb(d = lbDiff) {
    setLbLoad(true);
    try {
      const res = await window.storage.list(`lb:${d}:`, true);
      const rows = await Promise.all((res?.keys??[]).map(async k => {
        try { const r = await window.storage.get(k,true); return r?JSON.parse(r.value):null; }
        catch { return null; }
      }));
      setLb(rows.filter(Boolean).sort((a,b)=>a.time-b.time||a.moves-b.moves).slice(0,10));
    } catch(e) {}
    setLbLoad(false);
  }
  async function saveLb(t, m) {
    const e = { nickname:nick, time:t, moves:m, date:new Date().toLocaleDateString("ko-KR") };
    try { await window.storage.set(`lb:${diff}:${nick}_${Date.now()}`, JSON.stringify(e), true); } catch {}
  }

  // ── 게임 초기화 ─────────────────────────────
  function initGame(d = diff) {
    clearInterval(timerRef.current);
    const emojis = shuffle(ALL_EMOJIS).slice(0, DIFF[d].pairs);
    setCards(shuffle([...emojis,...emojis]).map((val,i)=>({id:i,val})));
    setFlipped([]); setMatched([]); setMoves(0);
    setWon(false); setShake([]);
    setTime(0); setRunning(false);
  }

  useEffect(()=>{ if(screen==="game") initGame(); }, [screen]);
  useEffect(()=>{ if(screen==="leaderboard") loadLb(lbDiff); }, [screen, lbDiff]);
  useEffect(()=>{
    if(running) timerRef.current = setInterval(()=>setTime(t=>t+1),1000);
    else clearInterval(timerRef.current);
    return ()=>clearInterval(timerRef.current);
  }, [running]);

  // ── 카드 클릭 ───────────────────────────────
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
  const tColor = time<30?"#34d399":time<60?"#fbbf24":"#f87171";

  // ════════════════════════════════════════════
  // 📱 화면 1: 설정
  // ════════════════════════════════════════════
  if (screen==="setup") return (
    <Wrap>
      <div style={{ textAlign:"center", maxWidth:380, width:"100%", animation:"fadeUp .5s ease" }}>
        {/* 로고 */}
        <div style={{ position:"relative", display:"inline-block", marginBottom:8 }}>
          <div style={{ fontSize:"4rem", filter:"drop-shadow(0 0 24px #ff6ef7)" }}>🃏</div>
          <div style={{ position:"absolute", top:-4, right:-4, width:14, height:14,
            borderRadius:"50%", background:"#ff6ef7", animation:"ping 1.5s infinite" }}/>
        </div>
        <h1 style={{ color:"#fff", fontSize:"2.6rem", margin:"0 0 4px", ...F,
          textShadow:"0 0 40px #ff6ef7, 0 0 80px #a78bfa88", letterSpacing:1 }}>
          기억력 게임
        </h1>
        <p style={{ color:"#a78bfa", ...N, fontSize:".9rem", marginBottom:28 }}>
          카드를 뒤집어 같은 쌍을 모두 찾아보세요!
        </p>

        {/* 닉네임 */}
        <div style={{ position:"relative", marginBottom:20 }}>
          <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)",
            fontSize:"1.1rem" }}>👤</span>
          <input value={nickIn} onChange={e=>setNickIn(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"&&nickIn.trim()){ setNick(nickIn.trim()); setScreen("game"); }}}
            placeholder="닉네임을 입력하세요" maxLength={12}
            style={{ width:"100%", padding:"13px 16px 13px 40px", borderRadius:14,
              background:"rgba(255,255,255,.08)", border:"2px solid rgba(167,139,250,.35)",
              color:"#fff", fontSize:"1rem", ...N, outline:"none",
              boxSizing:"border-box", backdropFilter:"blur(12px)",
              transition:"border-color .2s" }}
          />
        </div>

        {/* 난이도 */}
        <p style={{ color:"#7c6fa0", ...N, fontSize:".8rem", marginBottom:10, textAlign:"left", letterSpacing:.5 }}>
          ▸ 난이도 선택
        </p>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:22 }}>
          {Object.entries(DIFF).map(([key,d])=>(
            <div key={key} onClick={()=>setDiff(key)} style={{
              display:"flex", alignItems:"center", gap:14, padding:"13px 16px",
              borderRadius:16, cursor:"pointer",
              background:diff===key?`${d.color}15`:"rgba(255,255,255,.05)",
              border:`2px solid ${diff===key?d.color:"rgba(255,255,255,.08)"}`,
              boxShadow:diff===key?`0 0 20px ${d.color}30, inset 0 0 20px ${d.color}08`:"none",
              transition:"all .2s",
            }}>
              <span style={{ fontSize:"1.6rem" }}>{d.emoji}</span>
              <div style={{ flex:1, textAlign:"left" }}>
                <div style={{ color:diff===key?d.color:"#e2d9f3", ...F, fontSize:"1rem" }}>{d.label}</div>
                <div style={{ color:"#5b5278", ...N, fontSize:".75rem", marginTop:1 }}>{d.desc}</div>
              </div>
              <div style={{ width:20, height:20, borderRadius:"50%",
                border:`2px solid ${diff===key?d.color:"rgba(255,255,255,.15)"}`,
                background:diff===key?d.color:"transparent",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:".65rem", color:"#0d1b4b", transition:"all .2s" }}>
                {diff===key&&"✓"}
              </div>
            </div>
          ))}
        </div>

        <button onClick={()=>{ if(nickIn.trim()){ setNick(nickIn.trim()); setScreen("game"); }}}
          disabled={!nickIn.trim()}
          style={{ ...BtnPrimary, width:"100%", marginBottom:10,
            opacity:nickIn.trim()?1:.35,
            background:`linear-gradient(135deg, ${cfg.color}cc, #6d28d9)` }}>
          🎮 게임 시작
        </button>
        <button onClick={()=>{ setLbDiff(diff); setScreen("leaderboard"); }}
          style={{ ...BtnGhost, width:"100%" }}>
          🏆 리더보드 보기
        </button>
      </div>
      <CSS/>
    </Wrap>
  );

  // ════════════════════════════════════════════
  // 📱 화면 2: 게임
  // ════════════════════════════════════════════
  if (screen==="game") return (
    <Wrap>
      {/* 탑바 */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
        width:"100%", maxWidth:460, marginBottom:10 }}>
        <button onClick={()=>setScreen("setup")} style={BtnMini}>← 나가기</button>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          <span style={{ color:cfg.color, ...N, fontSize:".8rem",
            background:`${cfg.color}15`, padding:"4px 12px", borderRadius:20,
            border:`1px solid ${cfg.color}40` }}>
            {cfg.emoji} {cfg.label}
          </span>
          <button onClick={()=>setMuted(m=>!m)} style={{ ...BtnMini, padding:"5px 10px", fontSize:"1rem" }}>
            {muted?"🔇":"🔊"}
          </button>
        </div>
        <button onClick={()=>{ setLbDiff(diff); setScreen("leaderboard"); }} style={BtnMini}>🏆 순위</button>
      </div>

      <h1 style={{ color:"#fff", fontSize:"clamp(1.6rem,5vw,2.6rem)", margin:"0 0 2px",
        textShadow:"0 0 30px #ff6ef7", ...F }}>🃏 기억력 게임</h1>
      <p style={{ color:"#6d5f8a", ...N, fontSize:".8rem", margin:"0 0 16px" }}>
        👤 {nick}
      </p>

      {/* 스탯 */}
      <div style={{ display:"flex", gap:8, marginBottom:18, flexWrap:"wrap", justifyContent:"center" }}>
        {[
          {label:"⏱️ 시간", val:fmt(time), color:tColor},
          {label:"시도",    val:moves,     color:"#c084fc"},
          {label:"찾은 쌍", val:`${matched.length}/${cfg.pairs}`, color:"#c084fc"},
        ].map(({label,val,color})=>(
          <div key={label} style={{ background:"rgba(255,255,255,.06)", backdropFilter:"blur(8px)",
            border:"1px solid rgba(255,255,255,.08)", borderRadius:14,
            padding:"8px 20px", textAlign:"center", minWidth:80 }}>
            <div style={{ fontSize:"1.35rem", color, ...F }}>{val}</div>
            <div style={{ fontSize:".68rem", color:"#5b5278", ...N }}>{label}</div>
          </div>
        ))}
      </div>

      {/* 카드 그리드 */}
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${cfg.cols},1fr)`,
        gap:cfg.pairs>8?7:9, maxWidth:cfg.pairs>10?410:cfg.pairs>8?390:360 }}>
        {cards.map(card => {
          const face = isFlipped(card);
          const isMatch = matched.includes(card.val);
          const sz = cfg.pairs<=8?76:cfg.pairs<=10?68:60;
          return (
            <div key={card.id} onClick={()=>handleFlip(card)}
              style={{ width:sz, height:sz, perspective:700, cursor:face?"default":"pointer",
                animation:shake.includes(card.id)?"shake .45s ease":isMatch?"pop .35s ease":"none" }}>
              <div style={{ width:"100%", height:"100%", position:"relative",
                transformStyle:"preserve-3d", transition:"transform .38s cubic-bezier(.34,1.56,.64,1)",
                transform:face?"rotateY(180deg)":"rotateY(0)" }}>
                {/* 뒷면 */}
                <div style={{ ...CF,
                  background:"linear-gradient(145deg,#4c1d95,#1e40af)",
                  border:"1.5px solid rgba(167,139,250,.3)",
                  boxShadow:"0 4px 16px rgba(109,40,217,.35)",
                  fontSize:"1.3rem" }}>✨</div>
                {/* 앞면 */}
                <div style={{ ...CF, transform:"rotateY(180deg)",
                  background:isMatch
                    ?"linear-gradient(145deg,#064e3b,#065f46)"
                    :"linear-gradient(145deg,#1e1b4b,#2e1065)",
                  border:`1.5px solid ${isMatch?"#10b981":"rgba(139,92,246,.4)"}`,
                  fontSize:cfg.pairs<=8?"2rem":"1.6rem",
                  boxShadow:isMatch?"0 0 18px #10b98166":"0 2px 10px rgba(0,0,0,.4)" }}>
                  {card.val}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 승리 배너 */}
      {won && (
        <div style={{ marginTop:24, textAlign:"center", animation:"fadeUp .5s ease",
          background:"rgba(251,191,36,.08)", border:"1px solid #fbbf2433",
          borderRadius:20, padding:"20px 32px" }}>
          <div style={{ fontSize:"2.8rem", marginBottom:4 }}>🎉</div>
          <p style={{ color:"#fde68a", fontSize:"1.3rem", margin:"0 0 4px", ...F,
            textShadow:"0 0 20px #fbbf24" }}>
            클리어! {fmt(time)} · {moves}번 시도
          </p>
          <p style={{ color:"#92400e", ...N, fontSize:".8rem", margin:"0 0 14px" }}>
            {cfg.emoji} {cfg.label} 난이도
          </p>
          <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
            <button onClick={()=>{ setLbDiff(diff); setScreen("leaderboard"); }} style={BtnPrimary}>
              🏆 리더보드
            </button>
            <button onClick={()=>initGame(diff)} style={BtnGhost}>🔄 재도전</button>
          </div>
        </div>
      )}

      {!won && (
        <button onClick={()=>initGame(diff)} style={{ ...BtnGhost, marginTop:16 }}>🔄 다시 하기</button>
      )}
      <CSS/>
    </Wrap>
  );

  // ════════════════════════════════════════════
  // 📱 화면 3: 리더보드
  // ════════════════════════════════════════════
  return (
    <Wrap>
      <div style={{ width:"100%", maxWidth:460, animation:"fadeUp .4s ease" }}>
        <button onClick={()=>setScreen(nick?"game":"setup")} style={{ ...BtnMini, marginBottom:16 }}>
          ← 돌아가기
        </button>

        <h1 style={{ color:"#fff", fontSize:"2.2rem", margin:"0 0 4px", ...F,
          textShadow:"0 0 30px #fbbf24", textAlign:"center" }}>🏆 리더보드</h1>
        <p style={{ color:"#5b5278", ...N, fontSize:".8rem", textAlign:"center", marginBottom:16 }}>
          전체 TOP 10 · 난이도별 기록
        </p>

        {/* 난이도 탭 */}
        <div style={{ display:"flex", gap:6, marginBottom:20, justifyContent:"center" }}>
          {Object.entries(DIFF).map(([key,d])=>(
            <button key={key} onClick={()=>{ setLbDiff(key); }}
              style={{ padding:"7px 16px", borderRadius:20,
                border:`2px solid ${lbDiff===key?d.color:"rgba(255,255,255,.08)"}`,
                background:lbDiff===key?`${d.color}18`:"rgba(255,255,255,.04)",
                color:lbDiff===key?d.color:"#6b6080", cursor:"pointer", ...F, fontSize:".85rem",
                boxShadow:lbDiff===key?`0 0 14px ${d.color}33`:"none", transition:"all .2s" }}>
              {d.emoji} {d.label}
            </button>
          ))}
        </div>

        {lbLoading ? (
          <div style={{ color:"#5b5278", textAlign:"center", ...N, padding:48,
            background:"rgba(255,255,255,.04)", borderRadius:20 }}>
            <div style={{ fontSize:"2rem", marginBottom:8 }}>⏳</div>불러오는 중...
          </div>
        ) : lb.length===0 ? (
          <div style={{ color:"#5b5278", textAlign:"center", ...N,
            padding:48, background:"rgba(255,255,255,.04)", borderRadius:20 }}>
            <div style={{ fontSize:"2.5rem", marginBottom:8 }}>🎯</div>
            아직 기록이 없어요!<br/>첫 번째 주인공이 되어보세요
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {lb.map((e,i)=>{
              const isMe = e.nickname===nick;
              const dc = DIFF[lbDiff].color;
              return (
                <div key={i} style={{
                  display:"flex", alignItems:"center", gap:12,
                  background:isMe?"rgba(251,191,36,.1)":"rgba(255,255,255,.04)",
                  border:`1px solid ${isMe?"#fbbf2440":"rgba(255,255,255,.07)"}`,
                  borderRadius:14, padding:"12px 16px",
                  animation:`fadeUp .35s ease ${i*.06}s both`,
                  boxShadow:isMe?"0 0 18px rgba(251,191,36,.12)":"none",
                }}>
                  <div style={{ fontSize:i<3?"1.7rem":"1rem", minWidth:34,
                    textAlign:"center", ...F,
                    color:i<3?"inherit":"#4b4366" }}>
                    {i<3?MEDAL[i]:`${i+1}`}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ color:isMe?"#fde68a":"#d4c8f0", ...F, fontSize:".95rem" }}>
                      {e.nickname}{isMe&&<span style={{ color:"#fbbf24", fontSize:".75rem", marginLeft:6 }}>← 나</span>}
                    </div>
                    <div style={{ color:"#4b4366", ...N, fontSize:".7rem" }}>{e.date}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:"#34d399", ...F, fontSize:"1.1rem" }}>{fmt(e.time)}</div>
                    <div style={{ color:"#4b4366", ...N, fontSize:".7rem" }}>{e.moves}번 시도</div>
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
// 🎨 공통 스타일 & 컴포넌트
// ══════════════════════════════════════════════
const F = { fontFamily:"'Fredoka One',cursive" };
const N = { fontFamily:"'Nunito',sans-serif" };

const Wrap = ({children}) => (
  <div style={{ minHeight:"100vh", padding:"20px",
    background:"radial-gradient(ellipse at 20% 20%, #2d0a4e 0%, #0d1240 40%, #071a10 100%)",
    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
    ...F, position:"relative", overflow:"hidden" }}>
    {/* 별빛 배경 */}
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }}>
      {[...Array(24)].map((_,i)=>(
        <div key={i} style={{ position:"absolute",
          left:`${(i*37+11)%100}%`, top:`${(i*53+7)%100}%`,
          width: i%3===0?3:2, height: i%3===0?3:2,
          borderRadius:"50%", background:"#fff",
          opacity: .15 + (i%4)*.1,
          animation:`twinkle ${2+(i%3)}s ease-in-out ${(i*.3)%2}s infinite` }} />
      ))}
    </div>
    <div style={{ position:"relative", zIndex:1, width:"100%", display:"flex",
      flexDirection:"column", alignItems:"center" }}>
      <link href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;700&display=swap" rel="stylesheet"/>
      {children}
    </div>
  </div>
);

const CF = { position:"absolute", width:"100%", height:"100%",
  backfaceVisibility:"hidden", borderRadius:13,
  display:"flex", alignItems:"center", justifyContent:"center" };

const BtnPrimary = { padding:"12px 28px", borderRadius:50,
  background:"linear-gradient(135deg,#7c3aed,#1d4ed8)",
  color:"#fff", border:"none", fontSize:"1rem", ...F, cursor:"pointer",
  boxShadow:"0 4px 20px rgba(124,58,237,.45)", transition:"transform .15s, opacity .15s" };

const BtnGhost = { padding:"11px 26px", borderRadius:50,
  background:"rgba(255,255,255,.07)", border:"1px solid rgba(255,255,255,.12)",
  color:"#c4b5fd", fontSize:".95rem", ...F, cursor:"pointer", transition:"all .15s" };

const BtnMini = { padding:"6px 14px", borderRadius:20,
  background:"rgba(255,255,255,.07)", border:"1px solid rgba(255,255,255,.1)",
  color:"#9d8fbf", fontSize:".8rem", cursor:"pointer", ...N };

const CSS = () => <style>{`
  @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
  @keyframes pop{0%{transform:scale(1)}45%{transform:scale(1.2)}100%{transform:scale(1)}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes twinkle{0%,100%{opacity:.15}50%{opacity:.6}}
  @keyframes ping{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.2);opacity:0}}
  input::placeholder{color:#4b4366}
  button:hover{transform:scale(1.04)!important}
`}</style>;