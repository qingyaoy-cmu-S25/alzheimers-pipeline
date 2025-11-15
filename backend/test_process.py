import json
import urllib.request

url = 'http://127.0.0.1:8000/api/process_data'
csv_text = """Variable,IRR,CI_Lower,CI_Upper
const,0.0002889783508141036,0.00023717605041925178,0.00035209493998918816
verified,1507.8261697132798,1233.8182889936224,1842.6860570584165
log_followers,0.6800672524073829,0.6597107342057583,0.7010519062627224
"""

data = json.dumps({'data': csv_text}).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req) as res:
    print(res.status)
    print(res.read().decode('utf-8'))
