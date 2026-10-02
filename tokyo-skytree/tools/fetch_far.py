import math, json, os, sys
from remotezip import RemoteZip
from lxml import etree
from shapely.geometry import Polygon
LAT0,LON0=35.710063,139.8107
MLAT=111000; MLON=111000*math.cos(math.radians(LAT0))
NS={'gml':'http://www.opengis.net/gml','bldg':'http://www.opengis.net/citygml/building/2.0'}
def mesh3(lat,lon):
    p=int(lat*1.5); u=int(lon-100); r=lat*1.5-p; q=int(r*8); v=(lon-100-u)*8; w=int(v)
    s=int((r*8-q)*10); x=int((v-w)*10); return f'{p}{u}{q}{w}{s}{x}'
meshes={}
def addarea(lat,lon,rad_m,minh):
    for dz in range(-int(rad_m),int(rad_m)+1,400):
        for dx in range(-int(rad_m),int(rad_m)+1,400):
            if dx*dx+dz*dz>rad_m*rad_m: continue
            m=mesh3(lat-dz/MLAT,lon+dx/MLON); meshes[m]=min(meshes.get(m,999),minh)
addarea(LAT0,LON0,6000,15)
for (la,lo,mh) in [(35.6900,139.6950,60),(35.6812,139.7671,60),(35.665,139.757,60),(35.6605,139.735,60),(35.729,139.719,60),(35.6915,139.7005,60)]:
    addarea(la,lo,1300,mh)
near=set(os.path.basename(f)[:-4] for f in os.listdir('plat'))
todo=[m for m in sorted(meshes) if m not in near]
print(len(meshes),len(todo),flush=True)
u='https://gsic-opendata.s3.ap-northeast-1.amazonaws.com/national-gov/mlit/city-bureau/3d-city-model/2020/plateau-tokyo23ku/13100_tokyo23-ku_2020_citygml_3_2_op.zip'
out=json.load(open('far.json')) if os.path.exists('far.json') else {'done':[],'b':[]}
with RemoteZip(u) as z:
    names=set(z.namelist())
    for m in todo:
        if m in out['done']: continue
        n=f'13100_tokyo23-ku_2020_citygml_3_2_op/udx/bldg/{m}_bldg_6697_2_op.gml'
        if n not in names: out['done'].append(m); continue
        open('tmp.gml','wb').write(z.read(n)); minh=meshes[m]; cnt=0
        for ev,el in etree.iterparse('tmp.gml',tag='{http://www.opengis.net/citygml/building/2.0}Building'):
            h=el.find('bldg:measuredHeight',NS); h=float(h.text) if h is not None else 0
            if h>=minh:
                fp=el.find('bldg:lod0RoofEdge//gml:exterior//gml:posList',NS)
                if fp is None: fp=el.find('.//bldg:lod1Solid//gml:posList',NS)
                if fp is not None:
                    v=[float(x) for x in fp.text.split()]
                    pts=[((v[i+1]-LON0)*MLON,-(v[i]-LAT0)*MLAT) for i in range(0,len(v),3)]
                    try:
                        P=Polygon(pts).buffer(0)
                        if not P.is_empty and P.area>20:
                            Q=P.simplify(1.0) if h>=90 else P.minimum_rotated_rectangle
                            if Q.geom_type=='Polygon':
                                out['b'].append([round(h,1),[[round(x,1),round(y,1)] for x,y in list(Q.exterior.coords)[:-1]]]); cnt+=1
                    except Exception as e: pass
            el.clear()
            while el.getprevious() is not None: del el.getparent()[0]
        out['done'].append(m); print(m,minh,cnt,len(out['b']),flush=True)
        json.dump(out,open('far.json','w'))
