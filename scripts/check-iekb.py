"""Compare the portable snapshot with the source release, without modifying it."""
import argparse,collections,csv,json,pathlib,sqlite3
ROOT=pathlib.Path(__file__).resolve().parent.parent
DATA=ROOT/'sites/rhine-audiology/data'
def read(path):return json.loads(path.read_text(encoding='utf-8'))
def pages(folder,name):
 first=read(folder/f'{name}-1.json'); result=first['items'][:]
 assert len(first['items'])<=50
 for n in range(2,first['pages']+1):
  p=read(folder/f'{name}-{n}.json'); assert p['page']==n and p['total']==first['total'] and len(p['items'])<=50; result.extend(p['items'])
 assert len(result)==first['total'];return result
parser=argparse.ArgumentParser();parser.add_argument('--source',required=True,type=pathlib.Path);args=parser.parse_args()
source=args.source/'web/public/data'
db=sqlite3.connect((source/'iekb.db').resolve().as_uri()+'?mode=ro',uri=True);db.execute('PRAGMA query_only=ON');db.row_factory=sqlite3.Row
manifest=read(DATA/'manifest.json'); associations=[];report={'checks':[]}
for topic in manifest['topics']:
 records=pages(DATA/'topics'/topic['id'],'records');genes=pages(DATA/'topics'/topic['id'],'genes')
 assert {r['associated_phenotype'] for r in records}=={topic['title']}
 assert {g['id'] for g in genes}=={r['stable_gene_id'] for r in records}
 assert len(records)==topic['records'];assert len(genes)==topic['genes']
 associations.extend(records)
with (source/'downloads/gene_phenotype_disease.csv').open(encoding='utf-8-sig',newline='') as f:original=list(csv.DictReader(f))
for current,prior in zip(sorted(associations,key=lambda r:r['source_row']),original,strict=True):
 assert {k:current[k] for k in prior}==prior
 assert current['association_type'] in ['phenotype','mechanism_or_expression']
report['checks'].append('All association CSV fields preserved exactly; phenotype groups and stable gene IDs match')
interactions=pages(DATA/'all','interactions')
with (source/'downloads/gene_interactions.csv').open(encoding='utf-8-sig',newline='') as f:original=list(csv.DictReader(f))
for current,prior in zip(interactions,original,strict=True):assert {k:current[k] for k in prior}==prior
known={r['stable_gene_id'] for r in associations}
unassigned=pages(DATA/'all','unassigned')
assert len(unassigned)==66
assert all(not {r['gene_a_stable_id'],r['gene_b_stable_id']} & known for r in unassigned)
report['checks'].append('All 4,073 interactions preserved, including 66 outside topic-linked genes')
claims=pages(DATA/'all','claims')
original=[dict(r) for r in db.execute("SELECT * FROM claim_provenance WHERE claim_type != 'prediction' ORDER BY claim_id")]
assert claims==original
assert len({r['claim_id'] for r in claims})==55579
assert any(r['predicate']=='not_associated_with' for r in claims)
assert all(r['claim_type']!='prediction' and not r['prediction_run_id'] for r in claims)
report['checks'].append('55,579 complete non-predictive claims match SQLite, including negative predicates and review/verification states')
claim_groups=collections.Counter(r['subject_stable_gene_id'] or r['subject_registry_id'] or 'unresolved' for r in claims)
aliases=collections.defaultdict(list)
for r in db.execute('SELECT * FROM gene_aliases'):aliases[r['stable_gene_id']].append({'symbol':r['alias_symbol'],'type':r['alias_type']})
for gene_id in known:
 info=read(DATA/'genes'/f'{gene_id.replace(":","_")}.json')
 reg=dict(db.execute('SELECT * FROM gene_registry WHERE stable_gene_id=?',(gene_id,)).fetchone())
 assert info['registry']==reg and info['aliases']==aliases[gene_id]
 assert info['claims']['total']==claim_groups[gene_id]
 for field in ['records','claims','interactions','network']:
  chunk=info[field];assert len(chunk['items'])<=50
  for p in range(2,chunk['pages']+1):
   next_page=read(DATA/'genes'/f'{gene_id.replace(":","_")}-{field}-{p}.json');assert next_page['total']==chunk['total'] and len(next_page['items'])<=50
report['checks'].append('All 3,444 associated-gene registries and aliases preserved; gene detail pagination is complete')
relations=pages(DATA/'all','network')
original=[dict(r,kind='link') for r in db.execute('SELECT * FROM network_links')]+[dict(r,kind='edge') for r in db.execute('SELECT * FROM network_edges')]
assert relations==original
articles={}
for file in (DATA/'literature').glob('*.json'): articles.update(read(file))
assert articles=={r['pmid']:dict(r) for r in db.execute('SELECT * FROM articles')}
assert (DATA/'LICENSE.txt').read_bytes()==(source/'LICENSE.txt').read_bytes() or (DATA/'LICENSE.txt').read_text(encoding='utf-8')==(source/'LICENSE.txt').read_text(encoding='utf-8')
report['checks'].append('Known network relations, all 15,963 literature records and data license retained')
report['counts']=manifest['counts'];report['largestDataFileBytes']=max(f.stat().st_size for f in DATA.rglob('*') if f.is_file());report['dataBytes']=sum(f.stat().st_size for f in DATA.rglob('*') if f.is_file())
(ROOT/'verification/template/data-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2));db.close()
