from fastapi.testclient import TestClient
from main import app
import json

client = TestClient(app)

csv_text = """Variable,IRR,CI_Lower,CI_Upper
const,0.0002889783508141036,0.00023717605041925178,0.00035209493998918816
verified,1507.8261697132798,1233.8182889936224,1842.6860570584165
log_followers,0.6800672524073829,0.6597107342057583,0.7010519062627224
"""

resp = client.post('/api/process_data', json={'data': csv_text})
print(resp.status_code)
print(resp.text)
