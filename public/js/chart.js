// chart.js - 光谱图表功能（适配API路径）

let spectrumChart = null;
let chartData = {};
let isChartInitialized = false;

function initSpectrumChart() {
    console.log('初始化光谱图表...');
    const chartDom = document.getElementById('spectrum-chart');
    if (!chartDom) return;
    
    try {
        spectrumChart = echarts.init(chartDom);
        const option = {
            title: { text: '岩石光谱曲线', left: 'center', textStyle: { fontSize: 16 } },
            tooltip: { trigger: 'axis' },
            legend: { show: false },
            grid: { left: '8%', right: '5%', bottom: '10%', top: '20%', containLabel: true },
            xAxis: { type: 'value', name: '波长 (nm)', min: 350, max: 2500 },
            yAxis: { type: 'value', name: '反射率 (%)', min: 0, max: 100 },
            series: [{
                name: '光谱曲线', type: 'line', data: [], symbol: 'none', smooth: true,
                lineStyle: { width: 2, color: '#3498db' },
                areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(52, 152, 219, 0.3)' },
                    { offset: 1, color: 'rgba(52, 152, 219, 0.1)' }
                ]) }
            }]
        };
        spectrumChart.setOption(option, true);
        isChartInitialized = true;
        
        window.addEventListener('resize', () => {
            if (spectrumChart && !spectrumChart.isDisposed()) spectrumChart.resize();
        });
    } catch (error) {
        console.error('图表初始化失败:', error);
    }
}

async function loadSpectrumData(rock) {
    console.log('加载光谱数据:', rock.id);
    if (!rock.spectrum) {
        showAlert('该样本没有光谱数据', 'warning');
        return;
    }
    
    if (!isChartInitialized) initSpectrumChart();
    if (!spectrumChart || spectrumChart.isDisposed()) return;
    
    try {
        spectrumChart.showLoading('default', { text: '加载光谱数据中...' });
        const response = await fetch(`/spectra/${rock.spectrum}`);
        if (!response.ok) throw new Error('无法加载光谱文件');
        
        const csvText = await response.text();
        const lines = csvText.trim().split('\n');
        const dataPoints = [];
        let minWavelength = Infinity, maxWavelength = -Infinity;
        let minReflectance = Infinity, maxReflectance = -Infinity;
        
        for (const line of lines) {
            const parts = line.trim().split(',');
            if (parts.length < 2) continue;
            const wavelength = parseFloat(parts[0]);
            const reflectance = parseFloat(parts[1]);
            if (isNaN(wavelength) || isNaN(reflectance)) continue;
            dataPoints.push([wavelength, reflectance]);
            minWavelength = Math.min(minWavelength, wavelength);
            maxWavelength = Math.max(maxWavelength, wavelength);
            minReflectance = Math.min(minReflectance, reflectance);
            maxReflectance = Math.max(maxReflectance, reflectance);
        }
        
        if (dataPoints.length === 0) throw new Error('没有有效的光谱数据');
        
        updateChart(rock, dataPoints, minWavelength, maxWavelength, minReflectance, maxReflectance);
        chartData[rock.id] = { dataPoints, rock, minWavelength, maxWavelength, minReflectance, maxReflectance };
        spectrumChart.hideLoading();
    } catch (error) {
        console.error('加载光谱数据失败:', error);
        spectrumChart.hideLoading();
        showAlert('加载光谱数据失败: ' + error.message, 'error');
    }
}

function updateChart(rock, dataPoints, minWavelength, maxWavelength, minReflectance, maxReflectance) {
    if (!spectrumChart || spectrumChart.isDisposed()) return;
    
    const option = {
        title: {
            text: `${rock.id} - ${rock.lithology || rock.rock_type}`,
            subtext: `波长: ${minWavelength.toFixed(0)}-${maxWavelength.toFixed(0)}nm | 采样点: ${dataPoints.length}`,
            left: 'center'
        },
        xAxis: { type: 'value', name: '波长 (nm)', min: Math.max(340, Math.floor(minWavelength / 100) * 100), max: Math.ceil(maxWavelength / 100) * 100 },
        yAxis: { type: 'value', name: '反射率 (%)', min: Math.max(0, Math.floor(minReflectance * 10) / 10 - 5), max: Math.ceil(maxReflectance * 10) / 10 + 5 },
        series: [{
            name: rock.id, type: 'line', data: dataPoints, symbol: 'none', smooth: true,
            lineStyle: { width: 2, color: '#3498db' },
            areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(52, 152, 219, 0.3)' },
                { offset: 1, color: 'rgba(52, 152, 219, 0.05)' }
            ]) }
        }],
        tooltip: { trigger: 'axis', formatter: params => `${rock.id}<br>波长: ${params[0].axisValue.toFixed(1)} nm<br>反射率: ${params[0].data[1].toFixed(2)}%` },
        dataZoom: [{ type: 'inside', xAxisIndex: 0 }, { type: 'inside', yAxisIndex: 0 }]
    };
    spectrumChart.setOption(option, true);
}

function compareSpectra() {
    if (!spectrumChart || spectrumChart.isDisposed() || compareList.length < 2) return;
    
    const series = [];
    const legendData = [];
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
    let allMinWavelength = Infinity, allMaxWavelength = -Infinity;
    let allMinReflectance = Infinity, allMaxReflectance = -Infinity;
    
    compareList.forEach((rockId, index) => {
        const data = chartData[rockId];
        if (!data) return;
        allMinWavelength = Math.min(allMinWavelength, data.minWavelength);
        allMaxWavelength = Math.max(allMaxWavelength, data.maxWavelength);
        allMinReflectance = Math.min(allMinReflectance, data.minReflectance);
        allMaxReflectance = Math.max(allMaxReflectance, data.maxReflectance);
        series.push({
            name: data.rock.id, type: 'line', data: data.dataPoints, symbol: 'none', smooth: true,
            lineStyle: { width: 2, color: colors[index % colors.length] }
        });
        legendData.push(data.rock.id);
    });
    
    const option = {
        title: { text: '光谱对比图', subtext: `对比 ${series.length} 个样本`, left: 'center' },
        legend: { data: legendData, top: 360, type: 'scroll' },
        xAxis: { type: 'value', name: '波长 (nm)', min: Math.max(340, Math.floor(allMinWavelength / 100) * 100), max: Math.ceil(allMaxWavelength / 100) * 100 },
        yAxis: { type: 'value', name: '反射率 (%)', min: Math.max(0, Math.floor(allMinReflectance * 10) / 10 - 5), max: Math.ceil(allMaxReflectance * 10) / 10 + 5 },
        series: series,
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        dataZoom: [{ type: 'inside', xAxisIndex: 0 }]
    };
    spectrumChart.setOption(option, true);
}

function initChartControls() {
    const toggleSmooth = document.getElementById('toggle-smooth');
    const togglePoints = document.getElementById('toggle-points');
    const downloadChart = document.getElementById('download-chart');
    
    if (toggleSmooth) {
        toggleSmooth.addEventListener('click', () => {
            if (!spectrumChart) return;
            const option = spectrumChart.getOption();
            if (option.series?.length) {
                const smooth = !option.series[0].smooth;
                option.series.forEach(s => s.smooth = smooth);
                spectrumChart.setOption(option);
                toggleSmooth.innerHTML = smooth ? '<i class="fas fa-wave-square"></i> 原始曲线' : '<i class="fas fa-wave-square"></i> 平滑曲线';
            }
        });
    }
    
    if (togglePoints) {
        togglePoints.addEventListener('click', () => {
            if (!spectrumChart) return;
            const option = spectrumChart.getOption();
            if (option.series?.length) {
                const showSymbol = option.series[0].symbol === 'none';
                option.series.forEach(s => { s.symbol = showSymbol ? 'circle' : 'none'; s.symbolSize = showSymbol ? 4 : 0; });
                spectrumChart.setOption(option);
                togglePoints.innerHTML = showSymbol ? '<i class="fas fa-circle"></i> 隐藏数据点' : '<i class="fas fa-circle"></i> 显示数据点';
            }
        });
    }
    
    if (downloadChart) {
        downloadChart.addEventListener('click', () => {
            if (!spectrumChart) { showAlert('图表未初始化', 'warning'); return; }
            const imgData = spectrumChart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
            const link = document.createElement('a');
            link.href = imgData;
            link.download = `光谱图表_${Date.now()}.png`;
            link.click();
            showAlert('图表下载成功', 'success');
        });
    }
}