from remotezip import RemoteZip
import os
u='https://assets.cms.plateau.reearth.io/assets/a6/8b550a-071a-4e70-9296-4dc203a0065f/13107_sumida-ku_pref_2025_citygml_1_op.zip'
with RemoteZip(u) as z:
    names=set(z.namelist())
    for m in ['53394643','53394644','53394645','53394646','53394653','53394656','53394664','53394665','53394666','53394633','53394634','53394635','53394657','53394667','53394674','53394675','53394676']:
        n=f'udx/bldg/{m}_bldg_6697_op.gml'
        if n in names and not os.path.exists(f'p25/{m}_bldg.gml'):
            open(f'p25/{m}_bldg.gml','wb').write(z.read(n)); print(m,flush=True)
print('done')
