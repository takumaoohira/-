import json, math, struct, array
from shapely.geometry import Polygon, MultiPolygon, LineString, Point, box, shape, mapping
from shapely.ops import unary_union
from shapely.prepared import prep
from PIL import Image
import numpy as np
OUT='out/'
meta=json.load(open('out/aerial_meta.json'))
A18=np.asarray(Image.open('out/aerial18.jpg').convert('RGB')).astype(np.float32)
A16=np.asarray(Image.open('out/aerial16.jpg').convert('RGB')).astype(np.float32)
def sample(x,z):
    for k,A in (('18',A18),('16',A16)):
        m=meta[k]
        u=(x-m['x0'])/(m['x1']-m['x0'])*m['w']; v=(z-m['z0'])/(m['z1']-m['z0'])*m['h']
        if 2<=u<m['w']-3 and 2<=v<m['h']-3:
            return A[int(v)-1:int(v)+2,int(u)-1:int(u)+2].reshape(-1,3).mean(0)
    return None
plat=json.load(open('plat.json'))
far=json.load(open('far.json'))['b']
TOWN=[b for b in plat if b['id']=='13107-bldg-19558'][0]
TOWNP=Polygon(TOWN['p']).buffer(0)
NEAR_R=1550
near=[];farb=[]
for b in plat:
    if b['id'] in (TOWN['id'],'13107-bldg-19364'): continue
    try: P=Polygon(b['p']).buffer(0)
    except Exception: continue
    if P.is_empty or P.area<4: continue
    if P.geom_type=='MultiPolygon': P=max(P.geoms,key=lambda g:g.area)
    c=P.centroid; r=math.hypot(c.x,c.y); h=b['h'] or 3
    if r<=NEAR_R:
        Q=P.simplify(0.25)
        if Q.geom_type!='Polygon' or len(Q.exterior.coords)<4: Q=P
        pts=list(Q.exterior.coords)[:-1]
        if len(pts)>40: pts=list(P.simplify(0.8).exterior.coords)[:-1]
        col=None
        if h<35:
            ip=P.buffer(-1.2); ip=ip if (not ip.is_empty and ip.geom_type=='Polygon') else P
            ss=[sample(*p.coords[0]) for p in [ip.representative_point(),ip.centroid]]+[sample(*pt) for pt in list(ip.exterior.coords)[:4] if ip.geom_type=='Polygon']
            ss=[s for s in ss if s is not None]
            if ss: col=np.median(np.array(ss),0)
        near.append((pts,h,col))
    elif h>=15:
        Q=P.minimum_rotated_rectangle if h<90 else P.simplify(1.0)
        farb.append((list(Q.exterior.coords)[:-1],h))
for h,pts in far:
    cx=sum(p[0] for p in pts)/len(pts);cz=sum(p[1] for p in pts)/len(pts)
    if math.hypot(cx+5884,cz-5714)<90: continue
    farb.append((pts,h))
# encode near: int16 [n, h_dm, rgb565(as uint16 stored in int16), x,z dm ...]
arr=array.array('h')
for pts,h,col in near:
    arr.append(len(pts)); arr.append(min(32000,int(round(h*10))))
    if col is None: v=0
    else:
        r,g,bb=[int(max(0,min(255,c))) for c in col]; v=((r>>3)<<11)|((g>>2)<<5)|(bb>>3); v=v-65536 if v>32767 else v
        if v==0: v=1
    arr.append(v)
    for x,z in pts: arr.append(int(round(x*10))); arr.append(int(round(z*10)))
import base64;open(OUT+'bldg.b64.txt','w').write(base64.b64encode(arr.tobytes()).decode())
arr=array.array('h')
for pts,h in farb:
    if len(pts)<3: continue
    arr.append(len(pts)); arr.append(int(round(h)))
    for x,z in pts: arr.append(int(round(x))); arr.append(int(round(z)))
open(OUT+'far.b64.txt','w').write(base64.b64encode(arr.tobytes()).decode())
print('near',len(near),'far',len(farb))
# ---- water
g16=json.load(open('gsi.json')); g14=json.load(open('gsi14.json'))
def polys(f):
    if f['t']=='Polygon': return [f['g']]
    if f['t']=='MultiPolygon': return f['g']
    return []
NB=box(-1680,-1650,1700,1500)
w16=[Polygon(r[0],r[1:]).buffer(0.05) for f in g16['waterarea'] for r in polys(f) if len(r[0])>2]
w16=unary_union(w16).intersection(NB).buffer(-0.05)
w14=[Polygon(r[0],r[1:]).buffer(1) for f in g14['waterarea'] for r in polys(f) if len(r[0])>2]
w14=unary_union(w14).buffer(-1).difference(NB.buffer(-2))
w14=w14.intersection(box(-11500,-11500,11500,11500))
water=unary_union([w16,w14])
def tolist(G,tol):
    G=G.simplify(tol)
    gs=[G] if G.geom_type=='Polygon' else list(getattr(G,'geoms',[]))
    res=[]
    for p in gs:
        if p.geom_type!='Polygon' or p.area<30: continue
        res.append([[[round(x,1),round(z,1)] for x,z in p.exterior.coords[:-1]]]+[[[round(x,1),round(z,1)] for x,z in i.coords[:-1]] for i in p.interiors])
    return res
WN=tolist(water.intersection(box(-1700,-1700,1700,1700)),0.4)
WF=tolist(water.difference(box(-1700,-1700,1700,1700)),4)
print('water near',len(WN),sum(len(p[0]) for p in WN),'far',len(WF))
# ---- rail lines near
def lines(f):
    if f['t']=='LineString': return [f['g']]
    if f['t']=='MultiLineString': return f['g']
    return []
rails=[]
for f in g16['railway']:
    fc=f['p'].get('ftCode')
    if fc in (2801,2802,2803,2804):
        for L in lines(f):
            if any(abs(x)<1700 and abs(z)<1700 for x,z in L): rails.append({'s':{2801:'g',2802:'o',2803:'e',2804:'t'}[fc],'l':[[round(x,1),round(z,1)] for x,z in L]})
# ---- roads (centerlines)
roads=[]
RW={0:2.5,1:4.2,2:9,3:16}
for f in g16['road']:
    p=f['p'];fc=p.get('ftCode')
    if fc not in (2701,2703,2711,2713): continue
    rk=p.get('rnkWidth') or 0; w=p.get('Width') or RW.get(rk,4)
    for L in lines(f):
        if any(math.hypot(x,z)<1500 for x,z in L): roads.append({'w':w,'r':rk,'l':[[round(x,1),round(z,1)] for x,z in L],'lv':p.get('lvOrder',0)})
print('roads',len(roads),'rails',len(rails))
# ---- bridges: road centerlines crossing water (near)
wn=unary_union([Polygon(p[0],p[1:]) for p in WN])
wp=prep(wn)
bridges=[]
for r in roads:
    if r['lv']>0: continue
    L=LineString(r['l'])
    if not wp.intersects(L): continue
    I=L.intersection(wn)
    segs=[I] if I.geom_type=='LineString' else [g for g in getattr(I,'geoms',[]) if g.geom_type=='LineString']
    for s in segs:
        if s.length<3: continue
        # extend a bit beyond banks
        c=list(s.coords); a,b=c[0],c[-1];dx,dz=b[0]-a[0],b[1]-a[1];ln=math.hypot(dx,dz);ux,uz=dx/ln,dz/ln
        ext=LineString([(a[0]-ux*2,a[1]-uz*2)]+c[1:-1]+[(b[0]+ux*2,b[1]+uz*2)])
        D=ext.buffer(max(3,r['w'])/2,cap_style=2)
        if D.geom_type=='Polygon': bridges.append({'w':max(3,r['w']),'p':[[round(x,1),round(z,1)] for x,z in D.exterior.coords[:-1]],'l':[[round(x,1),round(z,1)] for x,z in ext.coords]})
print('bridges',len(bridges))
# ---- trees from aerial (z18 area), outside buildings/water/town
bunion=prep(unary_union([Polygon(p).buffer(0.8) for p,h,c in near if len(p)>=3 and math.hypot(*p[0])<800]+[TOWNP]))
m=meta['18'];A=A18;H,W,_=A.shape
trees=[]
step=4.0
xs=np.arange(-600,700,step); zs=np.arange(-680,760,step)
for z in zs:
    for x in xs:
        if math.hypot(x,z)>700: continue
        u=(x-m['x0'])/(m['x1']-m['x0'])*W; v=(z-m['z0'])/(m['z1']-m['z0'])*H
        px=A[int(v)-3:int(v)+4,int(u)-3:int(u)+4].reshape(-1,3)
        r,g,b=px[:,0],px[:,1],px[:,2]
        gr=((g>r+8)&(g>b+6)&(g<180)&(g>40)).mean()
        if gr>0.68:
            P=Point(x,z)
            if bunion.contains(P) or wp.contains(P): continue
            trees.append([round(x+np.random.uniform(-1,1),1),round(z+np.random.uniform(-1,1),1),round(float(gr),2)])
np.random.seed(1)
print('trees',len(trees))
# ---- chains of major roads for traffic
import collections
maj=[r for r in roads if r['r']>=3 and r['lv']==0]
def key(p): return (round(p[0]),round(p[1]))
ends=collections.defaultdict(list)
for i,r in enumerate(maj): ends[key(r['l'][0])].append(i); ends[key(r['l'][-1])].append(i)
used=set();chains=[]
def ang(a,b): return math.atan2(b[1]-a[1],b[0]-a[0])
for i,r in enumerate(maj):
    if i in used: continue
    used.add(i); line=list(r['l']); w=r['w']
    for direction in (1,0):
        while True:
            end=line[-1] if direction else line[0]
            prev=line[-2] if direction else line[1]
            a0=ang(prev,end); best=None
            for j in ends[key(end)]:
                if j in used: continue
                L=maj[j]['l']; nl=L if key(L[0])==key(end) else L[::-1]
                if abs(maj[j]['w']-w)>6: continue
                d=abs((ang(nl[0],nl[1])-a0+math.pi)%(2*math.pi)-math.pi)
                if d<0.6 and (best is None or d<best[0]): best=(d,j,nl)
            if not best: break
            used.add(best[1])
            if direction: line+=best[2][1:]
            else: line=best[2][::-1][:-1]+line
    ln=sum(math.hypot(line[k+1][0]-line[k][0],line[k+1][1]-line[k][1]) for k in range(len(line)-1))
    if ln>120: chains.append({'w':w,'l':line})
print('chains',len(chains))
labels=[{'n':f['p'].get('knj'),'c':f['p'].get('annoCtg'),'x':f['g'][0],'z':f['g'][1]} for f in g16['label'] if f['t']=='Point' and f['p'].get('knj') and abs(f['g'][0])<1700 and abs(f['g'][1])<1700]
world={'chains':chains,'labels':labels,'water':WN,'waterFar':WF,'rails':rails,'roads':[r for r in roads if r['r']>=2],'bridges':bridges,'trees':trees,'town':[[round(x,1),round(z,1)] for x,z in TOWNP.exterior.coords[:-1]],'aerial':meta}
json.dump(world,open(OUT+'world.json','w'),separators=(',',':'))
import os
for f in os.listdir(OUT): print(f,os.path.getsize(OUT+f))
