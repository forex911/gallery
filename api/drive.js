export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ error: 'Missing folder id parameter' });
  }

  const embedUrl = `https://drive.google.com/embeddedfolderview?id=${id}#grid`;
  
  try {
    // Fetch the folder HTML from Google Drive acting as a standard browser
    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch from Google Drive' });
    }
    
    const html = await response.text();
    
    // Return the raw HTML directly
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
    
  } catch (error) {
    console.error('Drive proxy error:', error);
    return res.status(500).json({ error: error.message });
  }
}
