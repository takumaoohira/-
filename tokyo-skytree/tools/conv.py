import mapbox_vector_tile as mvt, math, glob, json, os
LAT0,LON0=35.710063,139.8107
MLAT=111000; MLON=111000*math.cos(math.radians(LAT0))
def tile2ll(z,x,y):
    n=2**z; lon=x/n*360-180; lat=math.degrees(math.atan(math.sinh(math.pi*(1-2*y/n)))); return lat,lon
def ll2g(lat,lon): return ((lon-LON0)*MLON, -(lat-LAT0)*MLAT)
out={'building':[],'road':[],'railway':[],'waterarea':[],'river':[],'label':[],'structurea':[],'structurel':[],'symbol':[]}
for f in glob.glob('bv/*.pbf'):
    x,y=map(int,os.path.basename(f)[:-4].split('_'))
    d=mvt.decode(open(f,'rb').read(),default_options={'y_coord_down':True})
    for lname,L in d.items():
        ext=L['extent']
        def cv(p): 
            lat,lon=tile2ll(16,x+p[0]/ext,y+p[1]/ext); gx,gz=ll2g(lat,lon); return [round(gx,2),round(gz,2)]
        for ft in L['features']:
            g=ft['geometry'];t=g['type'];c=g['coordinates']
            if t=='Polygon': geo=[[cv(p) for p in ring] for ring in c]
            elif t=='MultiPolygon': geo=[[[cv(p) for p in ring] for ring in poly] for poly in c]
            elif t=='LineString': geo=[cv(p) for p in c]
            elif t=='MultiLineString': geo=[[cv(p) for p in l] for l in c]
            elif t=='Point': geo=cv(c)
            elif t=='MultiPoint': geo=[cv(p) for p in c]
            else: continue
            out.setdefault(lname,[]).append({'t':t,'g':geo,'p':ft['properties']})
json.dump(out,open('gsi.json','w'),ensure_ascii=False)
for k,v in out.items(): print(k,len(v))
