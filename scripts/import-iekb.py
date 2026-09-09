"""Read-only IEKB release importer. Re-running never overwrites authored Markdown.

python scripts/import-iekb.py --source C:\\workdir\\project\\iekb
Only the two release CSVs, SQLite, and the data license are read.
"""
import argparse
import collections
import csv
import datetime
import json
import pathlib
import re
import sqlite3
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / 'sites' / 'rhine-audiology'
PAGE = 50
WRITTEN=set()
GROUPS = {
 'auditory': ('Auditory Phenotypes', ['conductive hearing loss','hearing loss, unspecified type','high-frequency hearing loss','low-frequency hearing loss','mixed hearing loss','profound hearing loss','progressive hearing loss','progressive sensorineural hearing loss','sensorineural hearing loss','severe hearing loss','sudden sensorineural hearing loss','tinnitus']),
 'genetics': ('Genetics & Development', ['cochlear dysplasia','congenital hearing loss','genetic hearing loss','inner ear malformation','nonsyndromic hearing loss','nonsyndromic sensorineural hearing loss','semicircular canal dysgenesis','syndromic hearing loss']),
 'injury': ('Injury & Protection', ['age-related hearing loss (presbycusis)','aminoglycoside-induced hearing loss','autoimmune hearing loss','cisplatin-induced hearing loss','drug-induced hearing loss','infection-induced hearing loss','noise-induced hearing loss','otoprotection']),
 'cellular': ('Cellular & Neural Biology', ['auditory neuropathy','central auditory dysfunction','cochlear synaptopathy','hair cell degeneration','hair cell regeneration','normal inner ear function','spiral ganglion neuron degeneration']),
 'vestibular': ('Vestibular & Other Conditions', ['cholesteatoma','combined auditory and vestibular dysfunction','endolymphatic hydrops',"meniere's disease",'otitis media','otosclerosis','vertigo','vestibular dysfunction','vestibular schwannoma'])
}
def slug(s): return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
def gene_key(s): return re.sub(r'[^A-Za-z0-9_-]', '_', s)
def write(file, data):
 file.parent.mkdir(parents=True, exist_ok=True)
 file.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
 WRITTEN.add(file.resolve())
def csv_rows(file):
 with file.open(encoding='utf-8-sig', newline='') as handle: return list(csv.DictReader(handle))
def page(rows, number=1): return {'items': rows[(number-1)*PAGE:number*PAGE], 'page': number, 'pages': max(1,(len(rows)+PAGE-1)//PAGE), 'total': len(rows)}
def pages(folder, name, rows, start=1):
 for n in range(start, max(1,(len(rows)+PAGE-1)//PAGE)+1): write(folder / f'{name}-{n}.json',page(rows,n))
def terms(value): return [s.strip() for s in (value or '').split(';') if s.strip()]

def main():
 args=argparse.ArgumentParser(description=__doc__)
 args.add_argument('--source', required=True, type=pathlib.Path)
 args=args.parse_args()
 base=args.source.resolve() / 'web/public/data'
 associations=csv_rows(base/'downloads/gene_phenotype_disease.csv')
 interactions=csv_rows(base/'downloads/gene_interactions.csv')
 db=sqlite3.connect((base/'iekb.db').as_uri()+'?mode=ro',uri=True)
 db.execute('PRAGMA query_only=ON'); db.row_factory=sqlite3.Row
 rows=lambda table: [dict(r) for r in db.execute('SELECT * FROM '+table)]
 registry={r['stable_gene_id']:r for r in rows('gene_registry')}
 aliases=collections.defaultdict(list)
 for r in rows('gene_aliases'): aliases[r['stable_gene_id']].append({'symbol':r['alias_symbol'],'type':r['alias_type']})
 claims=[dict(r) for r in db.execute("SELECT * FROM claim_provenance WHERE claim_type != 'prediction' ORDER BY claim_id")]
 articles={r['pmid']:r for r in rows('articles')}
 expected_topics={v for _, topics in GROUPS.values() for v in topics}
 actual_topics={r['associated_phenotype'] for r in associations}
 if expected_topics != actual_topics: raise ValueError(f'Phenotype mapping mismatch: missing {expected_topics-actual_topics}, unexpected {actual_topics-expected_topics}')
 known={r['stable_gene_id'] for r in associations}
 if '' in known or any(g not in registry for g in known): raise ValueError('Association has missing/unresolved stable gene ID')
 counts={'topics':len(actual_topics),'associatedGenes':len(known),'sourceRecords':len(associations),'phenotypeRecords':sum(r['association_type']=='phenotype' for r in associations),'mechanismExpressionRecords':sum(r['association_type']=='mechanism_or_expression' for r in associations),'interactions':len(interactions),'nonPredictiveClaims':len(claims)}
 expected={'topics':44,'associatedGenes':3444,'sourceRecords':7376,'phenotypeRecords':6448,'mechanismExpressionRecords':928,'interactions':4073,'nonPredictiveClaims':55579}
 if counts!=expected: print(f'Release counts changed from the delivered baseline: {expected} -> {counts}',flush=True)
 if counts['phenotypeRecords']+counts['mechanismExpressionRecords']!=counts['sourceRecords']: raise ValueError('Unsupported association_type; review source classification before importing')
 print('Verified CSV/SQLite release counts.',counts,flush=True)
 existing=json.loads(subprocess.run(['node',str(ROOT/'scripts/content-ids.mjs'),'rhine-audiology'],cwd=ROOT,capture_output=True,text=True,encoding='utf-8',check=True).stdout)
 authored_ids={d['id'] for d in existing};authored_topics={d.get('dataKey') for d in existing}
 data=SITE/'data'; topic_rows=collections.defaultdict(list); gene_rows=collections.defaultdict(list)
 for i,r in enumerate(associations,2):
  r.update(record_id=f'assoc-{i-1:05}',source_file='gene_phenotype_disease.csv',source_row=i)
  topic_rows[r['associated_phenotype']].append(r);gene_rows[r['stable_gene_id']].append(r)
 gene_interactions=collections.defaultdict(list); unassigned=[]
 for i,r in enumerate(interactions,2):
  r.update(record_id=f'interaction-{i-1:05}',source_file='gene_interactions.csv',source_row=i)
  ids={r['gene_a_stable_id'],r['gene_b_stable_id']}
  if not ids & known: unassigned.append(r)
  for g in ids:
   if g: gene_interactions[g].append(r)
 counts['unassignedInteractions']=len(unassigned)
 if len(unassigned)!=66: print(f'Unassigned interaction count changed: 66 -> {len(unassigned)}',flush=True)
 gene_claims=collections.defaultdict(list)
 for r in claims: gene_claims[r['subject_stable_gene_id'] or r['subject_registry_id'] or 'unresolved'].append(r)
 network=[dict(r,kind='link') for r in rows('network_links')]+[dict(r,kind='edge') for r in rows('network_edges')]
 if any(r.get('finding_source','phenotype')!='phenotype' for r in network): raise ValueError('Unexpected network source; predictions must be excluded')
 symbol_ids={r['current_symbol']:g for g,r in registry.items()}
 gene_network=collections.defaultdict(list)
 for r in network:
  symbols={r.get('gene_symbol')}
  for end in ('source','target'):
   if r.get(end+'_type')=='gene': symbols.add(r.get(end+'_entity'))
  for g in {symbol_ids[s] for s in symbols if s in symbol_ids}:gene_network[g].append(r)
 clingen=collections.defaultdict(list);hhl=collections.defaultdict(list)
 for r in rows('clingen'): clingen[r['gene_symbol']].append(r)
 for r in rows('hhl'): hhl[r['gene_symbol']].append(r)
 counts.update(networkRelations=len(network),networkLinks=sum(r['kind']=='link' for r in network),networkEdges=sum(r['kind']=='edge' for r in network),articles=len(articles),clingen=sum(map(len,clingen.values())),hhl=sum(map(len,hhl.values())))
 all_genes=known | set(gene_interactions) | set(gene_claims) | set(gene_network)
 gene_index={}
 for g in sorted(all_genes):
  reg=registry.get(g,{'stable_gene_id':g,'current_symbol':g,'full_name':''})
  key=gene_key(g)
  if key in gene_index: raise ValueError(f'Gene filename collision: {g}')
  gene_index[key]=g
  symbol=reg['current_symbol']
  lists={'records':gene_rows[g],'claims':gene_claims[g],'interactions':gene_interactions[g],'network':gene_network[g]}
  item={'id':g,'registry':reg,'aliases':aliases[g],'clingen':clingen[symbol],'hhl':hhl[symbol],'topics':sorted({slug(r['associated_phenotype']) for r in gene_rows[g]}),**{k:page(v) for k,v in lists.items()}}
  write(data/'genes'/f'{key}.json',item)
  for k,v in lists.items():
   if len(v)>PAGE: pages(data/'genes',f'{key}-{k}',v,2)
 pages(data/'all','interactions',interactions); pages(data/'all','unassigned',unassigned); pages(data/'all','claims',claims); pages(data/'all','network',network)
 # Literature is bucketed to avoid a request per PMID and 16,000 tiny files.
 buckets=collections.defaultdict(dict)
 for pmid,article in articles.items(): buckets[str(int(pmid)%100) if pmid.isdigit() else 'other'][pmid]=article
 for bucket,items in buckets.items(): write(data/'literature'/f'{bucket}.json',items)
 write(data/'all'/'annotations.json',{'clingen':dict(clingen),'hhl':dict(hhl)})
 pages(data/'all','nodes',rows('network_nodes'))
 search_records=[];topic_index=[];number=0
 for column,(title,topics) in GROUPS.items():
  for phenotype in sorted(topics):
   number+=1;key=slug(phenotype);rr=topic_rows[phenotype]
   distinct=sorted({r['stable_gene_id'] for r in rr},key=lambda g:registry[g]['current_symbol'].lower())
   gi=[]
   for g in distinct:
    gr=[r for r in rr if r['stable_gene_id']==g]
    gi.append({'id':g,'symbol':registry[g]['current_symbol'],'fullName':registry[g]['full_name'],'records':len(gr),'phenotype':sum(r['association_type']=='phenotype' for r in gr),'mechanism':sum(r['association_type']=='mechanism_or_expression' for r in gr)})
   stats={'records':len(rr),'genes':len(distinct),'phenotype':sum(r['association_type']=='phenotype' for r in rr),'mechanism':sum(r['association_type']=='mechanism_or_expression' for r in rr)}
   write(data/'topics'/key/'summary.json',{'id':key,'phenotype':phenotype,**stats})
   pages(data/'topics'/key,'genes',gi);pages(data/'topics'/key,'records',rr)
   topic_index.append({'id':key,'title':phenotype,'column':column,**stats})
   for r in rr: search_records.append({'gene':r['stable_gene_id'],'topic':key,'column':column,'disease':r['disease_name'],'pmids':r['supporting_pmids'],'type':r['association_type'],'evidence':r['evidence_level'],'cells':terms(r['affected_cell_types'])})
   meta={'id':key,'number':number,'title':phenotype,'subtitle':phenotype.upper(),'column':column,'tags':['IEKB','known database'],'summary':'Curated IEKB source records, gene annotations and traceable evidence.','metadata':[{'label':'COLLECTION','value':title},{'label':'DATA SOURCE','value':'IEKB · Tian-lab'},{'label':'SCOPE','value':'Known database'},{'label':'REVIEW','value':'Source status retained per claim'}],'source':'https://doi.org/10.64898/2026.04.06.716823','layout':'knowledge','tabsFromHeadings':False,'dataKey':key}
   doc=SITE/'content'/f'{key}.md'
   if key not in authored_ids and key not in authored_topics:
    doc.parent.mkdir(parents=True,exist_ok=True)
    intro=f'## About this topic\n\nThis archive brings together IEKB records indexed under **{phenotype}**. The topic name follows the source release\'s normalized phenotype vocabulary. Original phenotypes and disease names remain available with each record.\n\n## Reading the evidence\n\n**Phenotype associations** and **mechanism / expression records** are labeled separately. A mechanism or expression record may discuss this phenotype without establishing a direct gene–phenotype association.\n\nOpen a gene to inspect the source wording, cell types, anatomical regions, study models, interactions and claim provenance. Negative predicates, source verification and human review status are preserved as supplied.\n\n## Scope and attribution\n\nInteractions and network relations provide context; they do not establish additional phenotype associations. This snapshot excludes predictions, Dark Matter, enrichment analysis and question answering.\n\nAdapted from the **IEKB known database**, produced by Tian-lab. Navigation, presentation and this introductory text were added for RHINE AUDIOLOGY. [IEKB data license](/data/LICENSE.txt): CC BY 4.0 for Tian-lab-authored data; third-party material retains its original terms.\n'
    doc.write_text('---\n'+json.dumps(meta,ensure_ascii=False,indent=2)+'\n---\n\n'+intro,encoding='utf-8')
 write(data/'search.json',{'genes':[{'id':g,'symbol':registry[g]['current_symbol'],'name':registry[g]['full_name'],'aliases':[a['symbol'] for a in aliases[g]]} for g in sorted(known)],'records':search_records,'topics':topic_index,'evidence':sorted({r['evidence_level'] for r in associations if r['evidence_level']}),'cells':sorted({c for r in search_records for c in r['cells']})})
 license_text=(base/'LICENSE.txt').read_text(encoding='utf-8')
 (data/'LICENSE.txt').write_text(license_text,encoding='utf-8'); WRITTEN.add((data/'LICENSE.txt').resolve())
 write(data/'manifest.json',{'formatVersion':1,'pageSize':PAGE,'counts':counts,'topics':topic_index,'sources':[{'path':'web/public/data/downloads/gene_phenotype_disease.csv','role':'Primary association records; original phenotype and mapping retained'},{'path':'web/public/data/downloads/gene_interactions.csv','role':'Original interactions'},{'path':'web/public/data/iekb.db','role':'Identifiers, aliases, non-predictive claims, literature, clinical annotations and known network records'}],'attribution':'IEKB / Tian-lab. Adapted into a static snapshot for RHINE AUDIOLOGY.','license':'/data/LICENSE.txt','exclusions':['prediction claims','Dark Matter','enrichment','question answering']})
 cfg=SITE/'site.json'
 if not cfg.exists():
  write(cfg,{'$schema':'../../schemas/site.schema.json','id':'rhine-audiology','locale':'en','title':'RHINE AUDIOLOGY · INNER EAR KNOWLEDGE BASE','description':'Explore the IEKB known database through curated phenotype archives, associated genes and traceable evidence.','port':5174,'brand':{'name':'RHINE AUDIOLOGY','subtitle':'INNER EAR KNOWLEDGE BASE','system':'KNOWLEDGE','systemAccent':'OS','company':'RHINE AUDIOLOGY','database':'INNER EAR KNOWLEDGE BASE','operator':'RESEARCHER','markText':'RHINE·AUDIOLOGY','labelCode':'R A / K B','exportPrefix':'RHINE-AUDIOLOGY'},'columns':[{'id':k,'title':v[0]} for k,v in GROUPS.items()],'defaultDocument':'sensorineural-hearing-loss','numberPrefix':'IE-','labels':{},'theme':{'lighting':'warm','background':'#e8e5e1','ink':'#10120e','accent':'#939078'},'features':{'expandedReader':True,'knowledgeBase':True,'pathTracing':True},'exportNotice':'Adapted from IEKB / Tian-lab. CC BY 4.0 for Tian-lab-authored data; third-party sources retain their terms. See /data/LICENSE.txt.','attribution':{'text':'IEKB / Tian-lab · Adapted presentation · Source review status retained','url':'https://doi.org/10.64898/2026.04.06.716823','license':'/data/LICENSE.txt'}})
 # Remove only retired, managed snapshot files after a successful import.
 allowed=ROOT/'sites/rhine-audiology/data'
 if data.resolve()!=allowed or data.is_symlink(): raise ValueError('Unsafe snapshot directory')
 for old in data.rglob('*'):
  if old.is_file() and old.resolve() not in WRITTEN:
   if old.is_symlink() or not old.resolve().is_relative_to(allowed):raise ValueError(f'Unsafe snapshot path: {old}')
   old.unlink()
 report={'importedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceRoot':str(args.source.resolve()),'readOnly':True,'counts':counts,'authoredMarkdown':'Created only when missing; never overwritten','allClaimsPreserved':sum(map(len,gene_claims.values()))==len(claims),'negationOrNegativeRelationPredicates':dict(collections.Counter(r['predicate'] for r in claims if 'not_' in (r['predicate'] or '') or 'negative' in (r['predicate'] or ''))),'sourceValidation':dict(collections.Counter(r['source_validation_status'] for r in claims)),'humanReview':dict(collections.Counter(r['review_status'] for r in claims)),'dataFiles':sum(1 for f in data.rglob('*') if f.is_file())}
 write(SITE/'import-report.json',report)
 db.close(); print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)

if __name__=='__main__': main()
