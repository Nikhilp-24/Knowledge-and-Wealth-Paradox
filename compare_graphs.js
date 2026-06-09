const puppeteer = require('puppeteer');

(async () => {
    console.log('Launching browser...');
    const browser = await puppeteer.launch();
    
    // Check Abhinav's graph (5501)
    console.log('Visiting Abhinavs Graph on 5501...');
    const page1 = await browser.newPage();
    await page1.goto('http://localhost:5501', { waitUntil: 'networkidle0' });
    
    // Let animation run for a few seconds
    await new Promise(r => setTimeout(r, 4000));
    
    const abhinavData = await page1.evaluate(() => {
        const plot = document.querySelector('.js-plotly-plot');
        if (!plot || !plot.data) return null;
        
        let usaPoint = null;
        for (const trace of plot.data) {
            if (!trace.x || !trace.text) continue;
            for (let i = 0; i < trace.text.length; i++) {
                if (trace.text[i].includes('United States')) {
                    usaPoint = {
                        x: trace.x[i],
                        y: trace.y[i],
                        size: trace.marker.size[i],
                        traceIndex: plot.data.indexOf(trace),
                        pointIndex: i
                    };
                    break;
                }
            }
            if (usaPoint) break;
        }
        
        return {
            layout: plot.layout,
            usaPoint
        };
    });
    
    console.log('\n--- ABHINAV DATA ---');
    console.log('USA Point:', abhinavData?.usaPoint);
    if (abhinavData && abhinavData.layout) {
        console.log('X-Axis Range:', abhinavData.layout.xaxis?.range);
        console.log('Y-Axis Range:', abhinavData.layout.yaxis?.range);
        console.log('X-Axis Autorange:', abhinavData.layout.xaxis?.autorange);
    }

    // Check Our graph (5500)
    console.log('\nVisiting Our Graph on 5500...');
    const page2 = await browser.newPage();
    await page2.goto('http://localhost:5500', { waitUntil: 'networkidle0' });
    
    await new Promise(r => setTimeout(r, 4000));
    
    const ourData = await page2.evaluate(() => {
        const plot = document.getElementById('viz1-plot');
        if (!plot || !plot.data) return null;
        
        let usaPoint = null;
        for (const trace of plot.data) {
            if (!trace.x || !trace.text) continue;
            for (let i = 0; i < trace.text.length; i++) {
                if (trace.text[i].includes('United States')) {
                    usaPoint = {
                        x: trace.x[i],
                        y: trace.y[i],
                        size: trace.marker.size[i],
                        traceIndex: plot.data.indexOf(trace),
                        pointIndex: i
                    };
                    break;
                }
            }
            if (usaPoint) break;
        }
        
        return {
            layout: plot.layout,
            usaPoint
        };
    });
    
    console.log('\n--- OUR DATA ---');
    console.log('USA Point:', ourData?.usaPoint);
    if (ourData && ourData.layout) {
        console.log('X-Axis Range:', ourData.layout.xaxis?.range);
        console.log('Y-Axis Range:', ourData.layout.yaxis?.range);
        console.log('X-Axis Autorange:', ourData.layout.xaxis?.autorange);
    }
    
    await browser.close();
})();
