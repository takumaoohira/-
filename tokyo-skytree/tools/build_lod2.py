# PLATEAU 2025（墨田区）: LOD2 → 三角形メッシュ（data/l2.b64.txt）, LOD1 → 押し出し用外形
import json, math, array, base64, numpy as np, mapbox_earcut as ec, os
from shapely.geometry import Polygon, Point
from shapely.prepared import prep
from shapely.ops import unary_union
exec(open('build_assets.py').read().split("plat=json.load")[0])  # sample()
LAT0,LON0=35.710063,139.8107; MLAT=111000; MLON=111000*math.cos(math.radians(LAT0))
def mesh_poly(code):
    c=str(code); lat=int(c[:2])/1.5+int(c[4])*5/60+int(c[6])*30/3600; lon=int(c[2:4])+100+int(c[5])*7.5/60+int(c[7])*45/3600
    x0=(lon-LON0)*MLON; x1=(lon+45/3600-LON0)*MLON; z0=-(lat+30/3600-LAT0)*MLAT; z1=-(lat-LAT0)*MLAT
    return Polygon([(x0,z0),(x1,z0),(x1,z1),(x0,z1)])
codes=[f.split('_')[0] for f in os.listdir('p25') if f.endswith('_bldg.gml')]
COV=prep(unary_union([mesh_poly(c) for c in codes]).buffer(-0.5))
R=1990
d=json.load(open('lod2all.json'))
def norm(P):
    P=np.array(P); n=np.zeros(3)
    for i in range(len(P)): a=P[i];b=P[(i+1)%len(P)]; n+=np.cross(a,b)
    return n
def tri(P):
    P=np.array(P,dtype=np.float64); n=norm(P); ax=int(np.argmax(np.abs(n)))
    Q=np.delete(P,ax,axis=1)
    try: idx=ec.triangulate_float64(Q,np.array([len(Q)],dtype=np.uint32))
    except Exception: return []
    return [P[idx[i:i+3]] for i in range(0,len(idx),3)]
l2=array.array('h'); lod1=[]; nl2=0; ntri=0
for b in d:
    c=b['c']; r=math.hypot(*c)
    if r>R: continue
    if not b['n']:
        if b['h'] and len(b['p'])>=3: lod1.append(b)
        continue
    town=b['name']=='東京スカイツリー'
    if b['name']=='とうきょうスカイツリー駅': continue
    if not b['name'] and abs(b['c'][0]-36.0)<1 and abs(b['c'][1]+62.6)<1:   # 線路南側の細長い構造物（新しいホームと推定）→ ゲーム側でホームとして作る
        gy=min(p[1] for P in b['s']['GroundSurface'] for p in P)
        STN25={'k':'stn_ground','h':round(max(p[1] for P in b['s']['RoofSurface'] for p in P)-gy,2),'p':[[round(p[0],2),round(p[2],2)] for p in b['s']['GroundSurface'][0]]}
        continue  # 駅舎はゲーム側の駅モデルで表現（LOD2 と二重にしない）
    S=b['s']; g=[p[1] for P in S.get('GroundSurface',[]) for p in P]
    allp=[p for k in S for P in S[k] for p in P]
    y0=min(g) if g else min(p[1] for p in allp)
    # 向き: 屋根の法線が上を向くのが多数派になるよう反転を決める
    rs=[norm(P)[1] for P in S.get('RoofSurface',[])]
    flip=sum(1 for v in rs if v<0)>len(rs)/2
    roofs=[];walls=[]
    if town:
        from shapely.geometry import Polygon as _P
        TR=[];EXC=[];CAN=[]
        for P in S['RoofSurface']:
            h=round(min(p[1] for p in P)-y0,1);pg=_P([(p[0],p[2]) for p in P]).buffer(0);c=pg.centroid
            if max(math.hypot(p[0],p[2]) for p in P)<40 or h>170: continue
            k='roof'
            if abs(h-19.9)<0.2: k='plaza'
            if abs(h-23.5)<0.2 and math.hypot(c.x-4,c.y+27)<3: k='pav'
            if abs(h-19.9)<0.2 and math.hypot(c.x-72,c.y+1)<3: k='curve'
            if abs(h-27.5)<0.2 and math.hypot(c.x-54,c.y+10)<3: k='bridge'
            if k=='roof' and h<15 and pg.area>30 and 2*pg.area/pg.length<4.0: k='canopy'
            if k in ('pav','curve','bridge'): EXC.append((pg.buffer(0.6),h+0.3))
            if k=='canopy': CAN.append((pg.buffer(0.6),h+0.3))
            TR.append({'h':h,'k':k,'p':[[round(p[0],2),round(p[2],2)] for p in P]})
        TOWN_TR=TR
    # 壁の向きを外側にそろえる：面の中心から法線方向へ0.4m進んだ点が、その壁より高い屋根の下（＝建物の中）なら裏返す
    try:
        _fp=S.get('GroundSurface',[None])[0];_fp=Polygon([(p[0],p[2]) for p in _fp]).buffer(0) if _fp else Polygon(b['p']).buffer(0)
    except Exception: _fp=None
    _roofs=[]
    for P in S.get('RoofSurface',[]):
        try:_roofs.append((prep(Polygon([(p[0],p[2]) for p in P]).buffer(0.05)),min(p[1] for p in P)-y0))
        except Exception: pass
    _fpp=prep(_fp.buffer(0.05)) if _fp is not None and not _fp.is_empty else None
    def _inside(x,z,ytop):
        if _fpp is None or not _fpp.contains(Point(x,z)): return False
        return any(rp.contains(Point(x,z)) and rh>=ytop-0.6 for rp,rh in _roofs) or not _roofs
    for k,L in (('RoofSurface',roofs),('WallSurface',walls)):
        for P in S.get(k,[]):
            if town:
                rmax=max(math.hypot(p[0],p[2]) for p in P)
                if rmax<40 or min(p[1] for p in P)>170: continue
                if any(math.hypot(p[0],p[2])<32 and p[1]-y0>34 for p in P): continue  # タワー本体の壁（基部の外側まで伸びた面）
                if any(max(p[1] for p in P)-y0<=hh and all(G.contains(Point(p[0],p[2])) for p in P) for G,hh in EXC): continue
                if k=='WallSurface' and any(max(p[1] for p in P)-y0<=hh and all(G.contains(Point(p[0],p[2])) for p in P) for G,hh in CAN): continue
            P=[[p[0],p[1]-y0,p[2]] for p in P]
            if flip: P=P[::-1]
            pc=None
            if k=='RoofSurface':
                try:
                    pg=Polygon([(p[0],p[2]) for p in P]).buffer(-0.6)
                    if pg.is_empty: pg=Polygon([(p[0],p[2]) for p in P]).buffer(0)
                    x0,z0,x1,z1=pg.bounds;st=max(1.0,math.sqrt(max(pg.area,1))/6);ss=[]
                    pp=prep(pg)
                    for gx in np.arange(x0+st/2,x1,st):
                        for gz in np.arange(z0+st/2,z1,st):
                            if pp.contains(Point(gx,gz)):
                                c=sample(gx,gz)
                                if c is not None: ss.append(c)
                    if not ss:
                        c=sample(pg.representative_point().x,pg.representative_point().y); ss=[c] if c is not None else []
                    if ss: pc=np.median(np.array(ss),0)
                except Exception: pc=None
            if k=='WallSurface':
                n=norm(P);hl=math.hypot(n[0],n[2])
                if hl>1e-6:
                    cx=sum(p[0] for p in P)/len(P);cz=sum(p[2] for p in P)/len(P);yt=max(p[1] for p in P)
                    if _inside(cx+n[0]/hl*0.4,cz+n[2]/hl*0.4,yt) and not _inside(cx-n[0]/hl*0.4,cz-n[2]/hl*0.4,yt): P=P[::-1]
            npoly=norm(P)
            for t in tri(P):
                nn=np.cross(t[1]-t[0],t[2]-t[0])
                if np.linalg.norm(nn)<1e-4: continue
                if k=='RoofSurface':
                    if nn[1]<0: t=t[::-1]
                elif np.dot(nn,npoly)<0: t=t[::-1]   # 三角形分割の向きを元の面の向きにそろえる
                L.append((t,pc) if k=='RoofSurface' else t)
    if not roofs and not walls: continue
    if r>1450 and not town:
        lod1.append({'p':[[p[0],p[2]] for p in (S.get('GroundSurface') or [[[q[0],0,q[1]] for q in b['p']]])[0]],'h':max([p[1] for t,_ in roofs for p in t]+[p[1] for t in walls for p in t])}); continue
    # footprint（当たり判定用）
    fp=S.get('GroundSurface',[None])[0]
    fp=[[p[0],p[2]] for p in fp] if fp else b['p']
    try:
        FP=Polygon(fp).buffer(0); FP=FP if FP.geom_type=='Polygon' else max(FP.geoms,key=lambda q:q.area); fp=list(FP.simplify(0.3).exterior.coords)[:-1]
    except Exception: fp=b['p']
    H=max([p[1] for t,_ in roofs for p in t]+[p[1] for t in walls for p in t])
    l2.extend([2 if town else 1,len(roofs),len(walls),len(fp),int(round(H*10))])
    for x,z in fp: l2.extend([int(round(x*10)),int(round(z*10))])
    for t,col in roofs:
        
        if col is None: v=0
        else:
            rr,gg,bb=[int(max(0,min(255,q))) for q in col]; v=((rr>>3)<<11)|((gg>>2)<<5)|(bb>>3); v=v-65536 if v>32767 else v
            if v==0: v=1
        l2.append(v)
        for p in t: l2.extend([int(round(p[0]*10)),int(round(p[1]*10)),int(round(p[2]*10))])
    for t in walls:
        for p in t: l2.extend([int(round(p[0]*10)),int(round(p[1]*10)),int(round(p[2]*10))])
    nl2+=1; ntri+=len(roofs)+len(walls)
json.dump(TOWN_TR+[STN25],open('out/town.json','w'));open('out/l2.b64.txt','w').write(base64.b64encode(l2.tobytes()).decode())
json.dump({'lod1':[{'p':b['p'],'h':b['h']} for b in lod1]},open('p25_lod1.json','w'))
# 2020 データを置き換える範囲（2025年度データを取得したメッシュ）
json.dump([list(mesh_poly(c).intersection(Point(0,0).buffer(1985,64)).exterior.coords) for c in codes if mesh_poly(c).intersects(Point(0,0).buffer(1985,64))],open('p25_cov.json','w'))
print('lod2',nl2,'tris',ntri,'bytes',len(l2)*2,'lod1',len(lod1))
