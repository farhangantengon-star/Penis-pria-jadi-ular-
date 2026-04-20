import { useEffect, useRef, useState, useCallback, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import { GameEngine } from '../gameEngine';
import { SKINS, ACCESSORIES, WORLD_SIZE } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Swords, Zap, RefreshCw, ShoppingBag, Coins, ChevronLeft, Check, Users } from 'lucide-react';
// @ts-ignore
import io from 'socket.io-client';
// @ts-ignore
import type { Socket } from 'socket.io-client';

export const GameCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine>(GameEngine.fromLocalStorage());
  const socketRef = useRef<any>(null);
  const inputRef = useRef({ angle: 0, isShooting: false });
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover' | 'shop'>('menu');
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(score);
  useEffect(() => { scoreRef.current = score; }, [score]);
  
  const [coins, setCoins] = useState(0);
  const [ownedItems, setOwnedItems] = useState<string[]>([]);
  const [equippedSkin, setEquippedSkin] = useState('skin_pink');
  const [equippedAcc, setEquippedAcc] = useState('acc_none');
  const [roomId, setRoomId] = useState('Global');
  const [playerName, setPlayerName] = useState('Guest');

  useEffect(() => {
    setCoins(engineRef.current.totalCoins);
    setOwnedItems(engineRef.current.ownedItems);
    setEquippedSkin(localStorage.getItem('worm_equipped_skin') || 'skin_pink');
    setEquippedAcc(localStorage.getItem('worm_equipped_acc') || 'acc_none');
  }, [gameState]);
  
  // Joystick State
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [joystickDir, setJoystickDir] = useState({ x: 0, y: 0, angle: 0 });
  
  // Skill State
  const [isShooting, setIsShooting] = useState(false);
  const toggleShooting = useCallback((val: boolean) => {
    setIsShooting(val);
    inputRef.current.isShooting = val;
  }, []);

  const handleBuyOrEquip = (item: any) => {
    const engine = engineRef.current;
    const isOwned = ownedItems.includes(item.id);

    if (isOwned) {
      if (item.type === 'skin') {
        localStorage.setItem('worm_equipped_skin', item.id);
        setEquippedSkin(item.id);
      } else {
        localStorage.setItem('worm_equipped_acc', item.id);
        setEquippedAcc(item.id);
      }
    } else if (coins >= item.price) {
      engine.totalCoins -= item.price;
      engine.ownedItems.push(item.id);
      localStorage.setItem('worm_coins', engine.totalCoins.toString());
      localStorage.setItem('worm_items', JSON.stringify(engine.ownedItems));
      setCoins(engine.totalCoins);
      setOwnedItems([...engine.ownedItems]);
      
      // Auto-equip after buying
      if (item.type === 'skin') {
        localStorage.setItem('worm_equipped_skin', item.id);
        setEquippedSkin(item.id);
      } else {
        localStorage.setItem('worm_equipped_acc', item.id);
        setEquippedAcc(item.id);
      }
    }
  };

  // Input Handling
  const handleJoystickStart = useCallback((e: ReactMouseEvent | ReactTouchEvent) => {
    // Only allow joystick in playing state
    if (gameStateRef.current !== 'playing') return;

    const clientX = 'touches' in e ? (e as any).touches[0].clientX : (e as any).clientX;
    const clientY = 'touches' in e ? (e as any).touches[0].clientY : (e as any).clientY;
    
    // Skill button area check (simple rectangle check)
    // Bottom right area is roughly 150x150
    const isSkillArea = clientX > window.innerWidth - 150 && clientY > window.innerHeight - 150;
    if (isSkillArea) return;

    setJoystickActive(true);
    setJoystickPos({ x: clientX, y: clientY });
  }, []);

  const handleJoystickMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!joystickActive) return;
    const clientX = 'touches' in e ? (e as any).touches[0].clientX : (e as any).clientX;
    const clientY = 'touches' in e ? (e as any).touches[0].clientY : (e as any).clientY;
    
    const dx = clientX - joystickPos.x;
    const dy = clientY - joystickPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Dynamic joystick: If we move too far, pull the base closer
    const maxPull = 120;
    if (dist > maxPull) {
      const angle = Math.atan2(dy, dx);
      setJoystickPos({
        x: clientX - Math.cos(angle) * maxPull,
        y: clientY - Math.sin(angle) * maxPull
      });
    }

    const maxDist = 60;
    const ratio = Math.min(dist, maxDist) / Math.max(dist, 1);
    const limitedX = dx * (dist > maxDist ? ratio : 1);
    const limitedY = dy * (dist > maxDist ? ratio : 1);
    
    setJoystickDir({ 
      x: limitedX, 
      y: limitedY, 
      angle: Math.atan2(dy, dx) 
    });
    inputRef.current.angle = Math.atan2(dy, dx);
  }, [joystickActive, joystickPos]);

  const handleJoystickEnd = useCallback(() => {
    setJoystickActive(false);
    setJoystickDir({ x: 0, y: 0, angle: joystickDir.angle }); // Keep angle to maintain direction
  }, [joystickDir.angle]);

  useEffect(() => {
    window.addEventListener('mousemove', handleJoystickMove);
    window.addEventListener('mouseup', handleJoystickEnd);
    window.addEventListener('touchmove', handleJoystickMove);
    window.addEventListener('touchend', handleJoystickEnd);
    return () => {
      window.removeEventListener('mousemove', handleJoystickMove);
      window.removeEventListener('mouseup', handleJoystickEnd);
      window.removeEventListener('touchmove', handleJoystickMove);
      window.removeEventListener('touchend', handleJoystickEnd);
    };
  }, [handleJoystickMove, handleJoystickEnd]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    handleResize();

  const loop = () => {
    const engine = engineRef.current;
    
    if (gameStateRef.current === 'playing' && socketRef.current) {
      socketRef.current.emit('player-input', inputRef.current);
    }

    render(ctx, engine);
    animationId = requestAnimationFrame(loop);
  };

  loop();
  return () => {
    cancelAnimationFrame(animationId);
    window.removeEventListener('resize', handleResize);
    if (socketRef.current) socketRef.current.disconnect();
  };
}, []); // No dependencies - loop runs once and stays independent

  const render = (ctx: CanvasRenderingContext2D, engine: GameEngine) => {
    const canvas = ctx.canvas;
    const player = engine.state.players.find(p => p.id === socketRef.current?.id);
    
    let cameraX = 0;
    let cameraY = 0;
    if (player && !player.isDead) {
      cameraX = player.segments[0].x - canvas.width / 2;
      cameraY = player.segments[0].y - canvas.height / 2;
    } else {
      cameraX = WORLD_SIZE / 2 - canvas.width / 2;
      cameraY = WORLD_SIZE / 2 - canvas.height / 2;
    }

    // Simple Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Simple Grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const gridSize = 100;
    const startX = -(cameraX % gridSize);
    const startY = -(cameraY % gridSize);
    
    for (let x = startX; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = startY; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Border
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 5;
    ctx.strokeRect(-cameraX, -cameraY, WORLD_SIZE, WORLD_SIZE);

    // Food (Simple)
    engine.state.food.forEach((f) => {
      if (f.isCoin) {
        // Gold Coin with shadow
        ctx.fillStyle = '#facc15';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#facc15';
        ctx.beginPath();
        ctx.arc(f.x - cameraX, f.y - cameraY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        ctx.fillStyle = '#ca8a04';
        ctx.font = 'bold 10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('$', f.x - cameraX, f.y - cameraY + 4);
      } else {
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(f.x - cameraX, f.y - cameraY, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Projectiles (Wavy)
    engine.state.projectiles.forEach((proj) => {
      ctx.save();
      ctx.translate(proj.x - cameraX, proj.y - cameraY);
      const angle = Math.atan2(proj.vy, proj.vx);
      ctx.rotate(angle);
      
      // Head
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Moving tail (Wavy)
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      for(let i=0; i<20; i+=4) {
        ctx.lineTo(-8-i, Math.sin(i * 0.5 + Date.now() * 0.02) * 5);
      }
      ctx.stroke();
      
      ctx.restore();
    });

    // Players (Simple)
    engine.state.players.forEach((p) => {
      if (p.isDead) return;

      const segments = p.segments;
      const bodyWidth = 24;
      
      // Determine color/skin
      let playerColor = p.color;
      if (playerColor === 'rainbow') {
        const hue = (Date.now() * 0.2) % 360;
        playerColor = `hsl(${hue}, 80%, 60%)`;
      }

      // Base (Eggs)
      if (segments.length > 5) {
        const last = segments[segments.length - 1];
        const secondLast = segments[segments.length - 3] || last;
        const baseAngle = Math.atan2(last.y - secondLast.y, last.x - secondLast.x);
        
        ctx.save();
        ctx.translate(last.x - cameraX, last.y - cameraY);
        ctx.rotate(baseAngle);
        
        ctx.fillStyle = playerColor;
        ctx.beginPath();
        ctx.arc(0, 16, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -16, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw main body
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = playerColor;
      ctx.lineWidth = bodyWidth;
      ctx.beginPath();
      ctx.moveTo(segments[0].x - cameraX, segments[0].y - cameraY);
      for (let i = 1; i < segments.length; i++) {
        ctx.lineTo(segments[i].x - cameraX, segments[i].y - cameraY);
      }
      ctx.stroke();

      // Head
      const head = segments[0];
      ctx.fillStyle = playerColor;
      ctx.beginPath();
      ctx.arc(head.x - cameraX, head.y - cameraY, bodyWidth/2 + 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Slit detail
      const nextSeg = segments[1] || head;
      const headAngle = Math.atan2(head.y - nextSeg.y, head.x - nextSeg.x);
      ctx.save();
      ctx.translate(head.x - cameraX, head.y - cameraY);
      ctx.rotate(headAngle);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bodyWidth / 4, 0);
      ctx.lineTo(bodyWidth / 2 + 2, 0);
      ctx.stroke();
      
      // Render Accessory
      if (p.accessoryId && p.accessoryId !== 'acc_none') {
        const acc = ACCESSORIES.find(a => a.id === p.accessoryId);
        if (acc) {
           ctx.font = '24px serif';
           ctx.textAlign = 'center';
           ctx.rotate(-Math.PI / 2); // Rotate emoji to face up relative to head
           ctx.fillText(acc.icon, 0, -20);
        }
      }
      
      ctx.restore();

      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = 'bold 12px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, head.x - cameraX, head.y - cameraY - 45);
    });
  };

  const startGame = () => {
    if (!socketRef.current) {
      socketRef.current = io();
      
      socketRef.current.on('game-state', (newState) => {
        const prevRunCoins = engineRef.current.state.players.find((p: any) => p.id === socketRef.current?.id)?.coins || 0;
        engineRef.current.syncState(newState);
        const me = newState.players.find((p: any) => p.id === socketRef.current?.id);
        
        if (me) {
          if (me.coins > prevRunCoins) {
             const diff = me.coins - prevRunCoins;
             engineRef.current.totalCoins += diff;
             localStorage.setItem('worm_coins', engineRef.current.totalCoins.toString());
             setCoins(engineRef.current.totalCoins);
          }
          if (me.score !== scoreRef.current) setScore(me.score);
          if (me.isDead && gameStateRef.current === 'playing') {
             setGameState('gameover');
          }
        }
      });
    }

    socketRef.current.emit('join-room', {
      roomId,
      name: playerName,
      skinId: equippedSkin,
      accessoryId: equippedAcc
    });

    setGameState('playing');
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950 font-sans cursor-none select-none touch-none">
      <canvas
        ref={canvasRef}
        onMouseDown={handleJoystickStart}
        onTouchStart={handleJoystickStart}
        className="block"
      />

      {/* Analog Joystick Visual */}
      <AnimatePresence>
        {joystickActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            style={{ left: joystickPos.x, top: joystickPos.y }}
            className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2"
          >
            <div className="w-32 h-32 rounded-full border-4 border-white/20 bg-white/5 backdrop-blur-sm flex items-center justify-center">
              <motion.div
                animate={{ x: joystickDir.x, y: joystickDir.y }}
                transition={{ type: 'spring', damping: 15 }}
                className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center"
              >
                <div className="w-2 h-2 rounded-full bg-slate-900" />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {gameState === 'menu' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl"
            onMouseDown={(e) => e.stopPropagation()} // Prevent joystick triggering on menu
          >
            <div className="text-center p-16 space-y-12">
              <div className="space-y-4">
                <motion.h1 
                   initial={{ y: -50 }} animate={{ y: 0 }}
                   className="text-9xl font-black text-white tracking-tighter uppercase italic leading-none"
                >
                  <span className="text-white">WORM</span> <span className="text-rose-500">BATTLE</span>
                </motion.h1>
                <p className="text-white/40 text-xl font-bold uppercase tracking-[0.5em]">Battle Royale Edition</p>
              </div>

              <div className="flex flex-col gap-4 max-w-sm mx-auto cursor-auto relative z-20">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest text-left">Your Player Name</label>
                  <input 
                    type="text" 
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="bg-white/10 border-2 border-white/10 rounded-2xl p-4 text-white font-black focus:outline-none focus:border-rose-500 transition-all text-center uppercase tracking-widest"
                    placeholder="ENTER NAME..."
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest text-left flex items-center gap-2 font-black">
                    <Users size={12} /> ROOM ID (FOR MABAR)
                  </label>
                  <input 
                    type="text" 
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="bg-white/10 border-2 border-white/10 rounded-2xl p-4 text-white font-black focus:outline-none focus:border-amber-500 transition-all text-center uppercase tracking-widest"
                    placeholder="Lobby"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 max-w-xl mx-auto">
                <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-2">
                  <RefreshCw className="text-sky-400 mx-auto" />
                  <p className="text-[10px] font-bold text-white/60 uppercase">Analog Movement</p>
                </div>
                <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-2">
                  <Zap className="text-amber-400 mx-auto" />
                  <p className="text-[10px] font-bold text-white/60 uppercase">Blast Skill</p>
                </div>
              </div>

              <div className="flex gap-4 items-center justify-center">
                <button
                  onClick={startGame}
                  className="group relative px-12 py-6 bg-rose-600 text-white text-2xl font-black uppercase rounded-full transition-all hover:scale-110 active:scale-95 shadow-xl shadow-rose-900/40 flex items-center gap-4"
                >
                  <Swords size={32} />
                  <span>Start Game</span>
                </button>
                
                <button
                  onClick={() => setGameState('shop')}
                  className="p-6 bg-amber-500 text-white rounded-full transition-all hover:scale-110 active:scale-95 shadow-xl shadow-amber-900/40 flex items-center gap-2"
                >
                  <ShoppingBag size={32} />
                  <span className="font-black text-xl">{coins}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {gameState === 'playing' && (
          <>
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-6 left-6 pointer-events-none flex gap-4"
            >
              <div className="p-4 px-6 bg-black/60 rounded-xl border border-white/10 flex items-center gap-4">
                <Trophy className="text-amber-400" size={20} />
                <span className="text-xl font-black text-white tabular-nums">{score}</span>
              </div>
              <div className="p-4 px-6 bg-black/60 rounded-xl border border-white/10 flex items-center gap-4">
                <Coins className="text-amber-400" size={20} />
                <span className="text-xl font-black text-white tabular-nums">{coins}</span>
              </div>
            </motion.div>

            {/* Skill Button */}
            <div className="absolute bottom-12 right-12">
               <button
                 onMouseDown={() => toggleShooting(true)}
                 onMouseUp={() => toggleShooting(false)}
                 onTouchStart={() => toggleShooting(true)}
                 onTouchEnd={() => toggleShooting(false)}
                 className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-xl border-4 border-white/20 flex flex-col items-center justify-center text-white active:scale-90 transition-transform shadow-2xl hover:bg-rose-500/20 active:bg-rose-500 group"
               >
                 <Zap className="group-active:scale-150 transition-transform" />
                 <span className="text-[10px] font-black uppercase mt-1">Skill</span>
               </button>
            </div>
          </>
        )}

        {gameState === 'shop' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950 flex flex-col p-8"
          >
            <div className="flex items-center justify-between mb-12">
              <button 
                onClick={() => setGameState('menu')}
                className="flex items-center gap-2 text-white hover:text-rose-500 transition-colors"
              >
                <ChevronLeft />
                <span className="font-black uppercase tracking-widest">Back to Menu</span>
              </button>
              
              <div className="flex items-center gap-4 bg-white/5 p-4 py-2 rounded-full border border-white/10">
                <Coins className="text-amber-400" />
                <span className="text-2xl font-black text-white">{coins}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-16 pb-24 scrollbar-hide">
              <section>
                <h3 className="text-white/40 uppercase font-black tracking-[0.3em] mb-8 text-sm">Select Skin</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                  {SKINS.map(skin => (
                    <button
                      key={skin.id}
                      onClick={() => handleBuyOrEquip(skin)}
                      className={`relative aspect-square rounded-3xl border-4 transition-all overflow-hidden flex flex-col items-center justify-center gap-2 bg-white/5 hover:bg-white/10 ${
                        equippedSkin === skin.id ? 'border-rose-500 shadow-lg shadow-rose-500/20 bg-rose-500/5' : 'border-white/10'
                      }`}
                    >
                      <div 
                        className="w-12 h-12 rounded-full border-2 border-white/20"
                        style={{ background: skin.color === 'rainbow' ? 'linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)' : skin.color }}
                      />
                      <span className="text-[10px] font-bold text-white uppercase text-center px-1">{skin.name}</span>
                      
                      {!ownedItems.includes(skin.id) && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm">
                           <Coins className="text-amber-400 mb-1" size={16} />
                           <span className="text-xs font-black text-white">{skin.price}</span>
                        </div>
                      )}
                      
                      {equippedSkin === skin.id && (
                        <div className="absolute top-2 right-2 p-1 bg-rose-500 rounded-full">
                          <Check size={10} className="text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-white/40 uppercase font-black tracking-[0.3em] mb-8 text-sm">Accessories</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                  {ACCESSORIES.map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => handleBuyOrEquip(acc)}
                      className={`relative aspect-square rounded-3xl border-4 transition-all overflow-hidden flex flex-col items-center justify-center gap-2 bg-white/5 hover:bg-white/10 ${
                        equippedAcc === acc.id ? 'border-amber-500 shadow-lg shadow-amber-500/20 bg-amber-500/5' : 'border-white/10'
                      }`}
                    >
                      <span className="text-4xl">{acc.icon}</span>
                      <span className="text-[10px] font-bold text-white uppercase">{acc.name}</span>
                      
                      {!ownedItems.includes(acc.id) && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm">
                           <Coins className="text-amber-400 mb-1" size={16} />
                           <span className="text-xs font-black text-white">{acc.price}</span>
                        </div>
                      )}

                      {equippedAcc === acc.id && (
                        <div className="absolute top-2 right-2 p-1 bg-amber-500 rounded-full">
                          <Check size={10} className="text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </motion.div>
        )}

        {gameState === 'gameover' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-rose-950/90 backdrop-blur-3xl"
          >
            <div className="text-center space-y-12">
              <div className="space-y-2">
                <motion.h2 
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="text-9xl font-black text-white italic uppercase tracking-tighter"
                >
                  DEFEAT
                </motion.h2>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="p-8 bg-white/5 border border-white/10 rounded-3xl">
                  <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-2">Final Score</p>
                  <p className="text-6xl font-black text-white">{score}</p>
                </div>
                <div className="p-8 bg-white/5 border border-white/10 rounded-3xl">
                  <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-2">Coins Earned</p>
                  <div className="flex items-center justify-center gap-4">
                    <Coins className="text-amber-400" size={40} />
                    <p className="text-6xl font-black text-white">{engineRef.current.state.players.find(p => p.type === 'player')?.coins || 0}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={startGame}
                className="p-10 bg-white text-black rounded-full shadow-[0_0_80px_rgba(255,255,255,0.3)] hover:scale-110 active:scale-90 transition-all font-black uppercase text-xl"
              >
                Respawn
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions */}
      <div className="absolute bottom-6 left-6 opacity-30 pointer-events-none">
        <p className="text-[10px] font-bold text-white uppercase tracking-widest">Touch anywhere for Joystick</p>
      </div>
    </div>
  );
};
