from lxml import etree
import glob, json, math
NS={'gml':'http://www.opengis.net/gml','bldg':'http://www.opengis.net/citygml/building/2.0'}
LAT0,LON0=35.710063,139.8107
MLAT=111000; MLON=111000*math.cos(math.radians(LAT0))
out=[]
for f in sorted(glob.glob('plat/*.gml')):
    for ev,el in etree.iterparse(f,tag='{http://www.opengis.net/citygml/building/2.0}Building'):
        h=el.find('bldg:measuredHeight',NS)
        h=float(h.text) if h is not None else None
        fp=el.find('bldg:lod0RoofEdge//gml:exterior//gml:posList',NS)
        if fp is None: fp=el.find('bldg:lod0FootPrint//gml:exterior//gml:posList',NS)
        zs=[float(x) for x in el.xpath('.//bldg:lod1Solid//gml:posList/text()',namespaces=NS)[0].split()[2::3]] if el.xpath('.//bldg:lod1Solid//gml:posList',namespaces=NS) else []
        if fp is None:
            pl=el.xpath('.//bldg:lod1Solid//gml:posList/text()',namespaces=NS)
            if pl: fp_txt=pl[0]
            else: el.clear(); continue
        else: fp_txt=fp.text
        v=[float(x) for x in fp_txt.split()]
        pts=[[round((v[i+1]-LON0)*MLON,2),round(-(v[i]-LAT0)*MLAT,2)] for i in range(0,len(v),3)]
        allz=[float(x) for t in el.xpath('.//bldg:lod1Solid//gml:posList/text()',namespaces=NS) for x in t.split()[2::3]]
        g=min(allz) if allz else 0; top=max(allz) if allz else (h or 0)
        bid=el.xpath('./gen:stringAttribute[@name="建物ID"]/gen:value/text()',namespaces={'gen':'http://www.opengis.net/citygml/generics/2.0'})
        out.append({'id':bid[0] if bid else '', 'h':h,'g':round(g,2),'top':round(top,2),'p':pts[:-1] if pts[0]==pts[-1] else pts})
        el.clear()
        while el.getprevious() is not None: del el.getparent()[0]
    print(f,len(out),flush=True)
json.dump(out,open('plat.json','w'))
