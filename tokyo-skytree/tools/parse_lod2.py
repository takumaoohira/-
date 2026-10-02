from lxml import etree
import json, math, sys
NS={'gml':'http://www.opengis.net/gml','bldg':'http://www.opengis.net/citygml/building/2.0','gen':'http://www.opengis.net/citygml/generics/2.0','uro':'https://www.geospatial.jp/iur/uro/3.1'}
LAT0,LON0=35.710063,139.8107
MLAT=111000; MLON=111000*math.cos(math.radians(LAT0))
R=float(sys.argv[2]) if len(sys.argv)>2 else 400
out=[]
for f in sys.argv[1].split(','):
    for ev,el in etree.iterparse(f,tag='{http://www.opengis.net/citygml/building/2.0}Building'):
        pl=el.xpath('.//bldg:lod0RoofEdge//gml:posList/text()|.//bldg:lod0FootPrint//gml:posList/text()',namespaces=NS)
        if not pl: pl=el.xpath('.//gml:posList/text()',namespaces=NS)
        v=[float(x) for x in pl[0].split()]
        cx=sum((v[i+1]-LON0)*MLON for i in range(0,len(v),3))/(len(v)/3); cz=sum(-(v[i]-LAT0)*MLAT for i in range(0,len(v),3))/(len(v)/3)
        if math.hypot(cx,cz)>R: el.clear(); continue
        h=el.find('bldg:measuredHeight',NS); h=float(h.text) if h is not None else None
        name=el.xpath('./gml:name/text()',namespaces=NS); usage=el.xpath('./bldg:usage/text()',namespaces=NS)
        st=el.xpath('./bldg:storeysAboveGround/text()',namespaces=NS)
        surfs={}
        for kind in ['RoofSurface','WallSurface','GroundSurface','OuterFloorSurface','ClosureSurface']:
            polys=[]
            for s in el.xpath(f'.//bldg:{kind}',namespaces=NS):
                for p in s.xpath('.//bldg:lod2MultiSurface//gml:Polygon|.//bldg:lod3MultiSurface//gml:Polygon',namespaces=NS):
                    ext=p.xpath('./gml:exterior//gml:posList/text()',namespaces=NS)
                    if not ext: continue
                    q=[float(x) for x in ext[0].split()]
                    polys.append([[round((q[i+1]-LON0)*MLON,2),round(q[i+2],2),round(-(q[i]-LAT0)*MLAT,2)] for i in range(0,len(q),3)][:-1])
            if polys: surfs[kind]=polys
        lod1=el.xpath('.//bldg:lod1Solid//gml:posList/text()',namespaces=NS)
        out.append({'name':name[0] if name else '','h':h,'st':st[0] if st else None,'c':[round(cx,1),round(cz,1)],'s':surfs,'n':sum(len(p) for p in surfs.values()),'p':[[round((v[i+1]-LON0)*MLON,2),round(-(v[i]-LAT0)*MLAT,2)] for i in range(0,len(v),3)][:-1],'id':(el.xpath('.//gen:stringAttribute[@name="建物ID"]/gen:value/text()|.//uro:buildingID/text()',namespaces=NS) or [''])[0]})
        el.clear()
        while el.getprevious() is not None: del el.getparent()[0]
json.dump(out,open(sys.argv[3] if len(sys.argv)>3 else 'lod2.json','w'))
lod2=[b for b in out if b['n']]
print(len(out),'with lod2',len(lod2))
big=sorted(lod2,key=lambda b:-(b['h'] or 0))[:25]
for b in big: print(b['name'],b['h'],b['st'],b['c'],{k:len(v) for k,v in b['s'].items()})
