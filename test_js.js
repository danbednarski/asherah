// Test the JavaScript syntax by extracting the key functions
async function testPerformSearch() {
    console.log('performSearch called');
    
    const query = 'bitcoin';
    console.log('Query:', query);
    
    try {
        const response = await fetch('http://localhost:3000/search?q=' + encodeURIComponent(query) + '&limit=20');
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);
        
        if (!response.ok) {
            throw new Error(data.error || 'Search failed');
        }
        
        console.log('About to call displayResults');
        testDisplayResults(data);
        console.log('displayResults called');
        
    } catch (error) {
        console.error('Search error:', error);
    }
}

function testDisplayResults(data) {
    console.log('displayResults called with data:', data);
    
    if (data.results.length === 0) {
        console.log('No results found');
        return;
    }
    console.log('Processing', data.results.length, 'results');
    
    let html = '<h3>Found ' + data.results.length + ' results for "' + data.query + '"</h3>';
    
    data.results.forEach(result => {
        let displayContent = result.content_text ? result.content_text.substring(0, 300) : 'No content available';
        let displayTitle = result.title || 'Untitled';

        html += '<div class="result">' +
                '<a href="' + result.url + '">' + result.url + '</a>' +
                '<div>' + displayTitle + '</div>' +
                '<div>' + result.domain + '</div>' +
                '<div>' + displayContent + '</div>' +
            '</div>';
    });
    
    console.log('Final HTML length:', html.length);
    console.log('HTML preview:', html.substring(0, 200));
}

testPerformSearch();