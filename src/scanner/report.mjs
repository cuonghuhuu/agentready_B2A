/**
 * Report exporters (JSON and Markdown) for AgentReady B2A AI Readiness Scanner.
 */

export function formatReportJson(result) {
  return JSON.stringify(result, null, 2);
}

export function formatReportMarkdown(result, lang = 'en') {
  const isVi = lang === 'vi';
  const s = result.summary;
  const lines = [];

  lines.push(`# ${isVi ? 'Báo cáo Đánh giá AI Readiness — AgentReady B2A' : 'AgentReady B2A — AI Readiness Scan Report'}`);
  lines.push('');
  lines.push(`> ${result.disclaimer}`);
  lines.push('');
  lines.push(`- **${isVi ? 'URL mục tiêu' : 'Target URL'}:** ${result.targetUrl}`);
  lines.push(`- **${isVi ? 'URL cuối cùng' : 'Final URL'}:** ${result.finalUrl}`);
  lines.push(`- **${isVi ? 'Hồ sơ trang' : 'Site Profile'}:** \`${result.siteProfile}\``);
  lines.push(`- **${isVi ? 'Thời điểm quét' : 'Scanned At'}:** ${result.finishedAt} (${result.durationMs} ms)`);
  lines.push(`- **${isVi ? 'Phiên bản thang điểm' : 'Scoring Version'}:** \`${result.scoringVersion}\` (Schema \`${result.schemaVersion}\`)`);
  lines.push('');

  lines.push(`## ${isVi ? 'Tổng quan Điểm số' : 'Score Summary'}`);
  lines.push('');
  lines.push(`| ${isVi ? 'Chỉ số' : 'Metric'} | ${isVi ? 'Giá trị' : 'Value'} |`);
  lines.push('| --- | --- |');
  lines.push(`| ${isVi ? 'Điểm đạt được' : 'Awarded Score'} | **${s.awardedScore} / ${s.totalMaxScore}** |`);
  lines.push(`| ${isVi ? 'Điểm tối đa áp dụng' : 'Applicable Max Score'} | **${s.applicableMaxScore} / ${s.totalMaxScore}** |`);
  lines.push(`| ${isVi ? 'Điểm quy đổi theo phần áp dụng' : 'Normalized Applicable Score'} | **${s.normalizedApplicableScore}%** (${s.grade}) |`);
  lines.push(`| ${isVi ? 'Độ phủ kiểm chứng' : 'Verification Coverage'} | **${s.verificationCoveragePercent}%** (${s.verifiedMaxScore}/${s.applicableMaxScore} pts) |`);
  lines.push(`| ${isVi ? 'Trạng thái tiêu chí' : 'Criterion Breakdown'} | PASS: ${s.statusCounts.PASS}, PARTIAL: ${s.statusCounts.PARTIAL}, FAIL: ${s.statusCounts.FAIL}, UNVERIFIED: ${s.statusCounts.UNVERIFIED}, NOT_APPLICABLE: ${s.statusCounts.NOT_APPLICABLE} |`);
  lines.push('');

  lines.push(`## ${isVi ? 'Điểm theo Nhóm tiêu chí' : 'Category Breakdown'}`);
  lines.push('');
  lines.push(`| ${isVi ? 'Nhóm' : 'Category'} | ${isVi ? 'Điểm đạt' : 'Awarded'} | ${isVi ? 'Tối đa áp dụng' : 'Applicable Max'} | ${isVi ? 'Tối đa chuẩn' : 'Category Max'} |`);
  lines.push('| --- | ---: | ---: | ---: |');
  for (const cat of result.categories) {
    lines.push(`| ${cat.name} | ${cat.awardedScore} | ${cat.applicableMaxScore} | ${cat.maxScore} |`);
  }
  lines.push('');

  lines.push(`## ${isVi ? 'Tín hiệu phát hiện vs. Khả năng đã kiểm chứng' : 'Detected Signals vs. Verified Capabilities'}`);
  lines.push('');
  lines.push(`- **${isVi ? 'Khả năng đã kiểm chứng (HTTP)' : 'Verified Capabilities (HTTP)'}:** ${result.capabilities.verifiedCapabilities.join(', ') || (isVi ? 'Không có' : 'None')}`);
  lines.push(`- **${isVi ? 'Tín hiệu tĩnh phát hiện' : 'Detected Static Signals'}:** ${result.capabilities.detectedSignals.join(', ') || (isVi ? 'Không có' : 'None')}`);
  lines.push(`- **${isVi ? 'Chưa kiểm chứng runtime' : 'Unverified Capabilities'}:** ${result.capabilities.unverifiedCapabilities.join(', ') || (isVi ? 'Không có' : 'None')}`);
  lines.push('');

  lines.push(`## ${isVi ? 'Chi tiết Tiêu chí, Bằng chứng & Khuyến nghị' : 'Detailed Criteria, Evidence & Recommendations'}`);
  lines.push('');
  for (const c of result.criteria) {
    lines.push(`### ${c.id} — ${c.title} (${c.awardedPoints}/${c.maxPoints} · ${c.status})`);
    lines.push('');
    lines.push(`- **${isVi ? 'Giải thích' : 'Explanation'}:** ${c.explanation}`);
    lines.push(`- **${isVi ? 'Bằng chứng' : 'Evidence'}:**`);
    for (const ev of c.evidence) {
      lines.push(`  - ${ev}`);
    }
    lines.push(`- **${isVi ? 'Khuyến nghị khắc phục' : 'Recommended Fix'}:** ${c.recommendedFix}`);
    lines.push('');
  }

  return lines.join('\n');
}
