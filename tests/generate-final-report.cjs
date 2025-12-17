/**
 * Generate Final Report from Section Reports
 */

const fs = require('fs');
const path = require('path');

const sectionsDir = path.join(__dirname, '../test-reports/sections');

function generateFinalReport() {
  console.log('📊 Generating Final Report from Section Reports...\n');

  const sectionFiles = fs.readdirSync(sectionsDir)
    .filter(f => f.endsWith('-latest.json'))
    .map(f => path.join(sectionsDir, f));

  const allResults = [];
  const sectionSummaries = [];
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  for (const file of sectionFiles) {
    try {
      const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
      const sectionName = path.basename(file).replace('-latest.json', '');
      
      allResults.push(...content.results);
      
      const report = content.report;
      sectionSummaries.push({
        name: sectionName,
        totalTests: report.totalTests,
        passedTests: report.passedTests,
        failedTests: report.failedTests,
        passRate: report.totalTests > 0 ? ((report.passedTests / report.totalTests) * 100).toFixed(2) : '0'
      });

      totalTests += report.totalTests;
      totalPassed += report.passedTests;
      totalFailed += report.failedTests;
    } catch (error) {
      console.warn(`⚠️  Failed to read ${file}:`, error.message);
    }
  }

  // Group by category
  const byCategory = {};
  for (const result of allResults) {
    const category = result.category || 'unknown';
    if (!byCategory[category]) {
      byCategory[category] = { passed: 0, failed: 0, total: 0 };
    }
    byCategory[category].total++;
    if (result.passed) {
      byCategory[category].passed++;
    } else {
      byCategory[category].failed++;
    }
  }

  const finalReport = {
    timestamp: new Date().toISOString(),
    totalTests,
    passedTests: totalPassed,
    failedTests: totalFailed,
    passRate: totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(2) : '0',
    sections: sectionSummaries,
    byCategory,
    summary: {
      totalTests,
      passedTests: totalPassed,
      failedTests: totalFailed,
      passRate: totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(2) : '0'
    }
  };

  const reportPath = path.join(__dirname, '../test-reports/FINAL_TEST_REPORT.json');
  fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));

  // Generate text summary
  let textReport = '='.repeat(80) + '\n';
  textReport += '📊 FINAL TEST REPORT SUMMARY\n';
  textReport += '='.repeat(80) + '\n\n';
  textReport += `Generated: ${new Date().toLocaleString()}\n`;
  textReport += `Total Tests: ${totalTests}\n`;
  textReport += `✅ Passed: ${totalPassed}\n`;
  textReport += `❌ Failed: ${totalFailed}\n`;
  textReport += `📈 Pass Rate: ${finalReport.passRate}%\n\n`;
  
  textReport += '='.repeat(80) + '\n';
  textReport += '📋 SECTION SUMMARY\n';
  textReport += '='.repeat(80) + '\n\n';
  
  for (const section of sectionSummaries) {
    textReport += `${section.name}:\n`;
    textReport += `  Total: ${section.totalTests} | Passed: ${section.passedTests} | Failed: ${section.failedTests} | Rate: ${section.passRate}%\n\n`;
  }

  textReport += '='.repeat(80) + '\n';
  textReport += '📊 BY CATEGORY\n';
  textReport += '='.repeat(80) + '\n\n';
  
  for (const [category, stats] of Object.entries(byCategory)) {
    const passRate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : '0';
    textReport += `${category}:\n`;
    textReport += `  Total: ${stats.total} | Passed: ${stats.passed} | Failed: ${stats.failed} | Rate: ${passRate}%\n\n`;
  }

  const textReportPath = path.join(__dirname, '../test-reports/FINAL_TEST_REPORT.txt');
  fs.writeFileSync(textReportPath, textReport);

  console.log(textReport);
  console.log(`\n📄 JSON Report: ${reportPath}`);
  console.log(`📄 Text Report: ${textReportPath}`);
}

generateFinalReport();

