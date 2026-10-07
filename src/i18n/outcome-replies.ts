const en = {
  title: 'Outcome replies', independent: 'Set a separate reply for this outcome', reset: 'Restore inheritance',
  inherited: 'Inherited from {{source}}', original: 'Original command template', global: 'Global', unavailable: 'Inherited text is unavailable. Refresh and try again.',
  hint: 'Specific outcome reply → standard reply at the same level → original command text. Empty slots inherit. Each outcome can have weighted replies and nested sample; personas work as usual. Only outcomes supported by the command appear.',
  preview_hint: 'The preview uses this outcome and sample values, without rolling dice. When inherited, the original command may choose a different template for a reason, SAN loss or growth.',
  families: { standard: 'Standard check', bonus: 'Bonus dice', penalty: 'Penalty dice', brp: 'BRP check', sanity: 'SAN check', growth: 'Growth check', psychology: 'Hidden psychology', opposed: 'Opposed check', resist: 'BRP resistance', dnd_check: 'DND check', death_save: 'Death save' },
  grades: { critical: 'Critical success', extreme: 'Extreme success', hard: 'Hard success', regular: 'Success', failure: 'Failure', fumble: 'Fumble', special: 'Special success', tie: 'Tie' },
};
export const outcomeReplies = {
  en,
  'zh-Hans': {
    title: '按结果分级回复', independent: '单独设置此等级回复', reset: '恢复继承',
    inherited: '当前继承：{{source}}', original: '指令原有文案', global: '全局', unavailable: '继承文案未加载，请刷新后重试。',
    hint: '本类检定的等级回复 → 标准检定的同等级回复 → 指令原有文案。留空即继承。每个等级都支持多条概率文案、嵌套 sample 和人格覆盖；只显示此指令实际支持的判定结果。',
    preview_hint: '预览按当前等级代入示例值，不执行真实掷骰。继承原有文案时，实际指令仍会按原因、理智损失或成长情况选择原有模板。',
    families: { standard: '标准检定', bonus: '奖励骰', penalty: '惩罚骰', brp: 'BRP 检定', sanity: '理智检定', growth: '成长检定', psychology: '心理学暗骰', opposed: '对抗检定', resist: 'BRP 抵抗', dnd_check: 'DND 检定', death_save: '死亡豁免' },
    grades: { critical: '大成功', extreme: '极难成功', hard: '困难成功', regular: '成功', failure: '失败', fumble: '大失败', special: '特殊成功', tie: '平局' },
  },
  'zh-Hant': {
    title: '按結果分級回覆', independent: '單獨設定此等級回覆', reset: '恢復繼承',
    inherited: '目前繼承：{{source}}', original: '指令原有文案', global: '全域', unavailable: '繼承文案未載入，請重新整理後重試。',
    hint: '本類檢定的等級回覆 → 標準檢定的同等級回覆 → 指令原有文案。留空即繼承。每個等級都支援多條機率文案、巢狀 sample 與人格覆蓋；只顯示此指令實際支援的判定結果。',
    preview_hint: '預覽按目前等級代入示例值，不執行真實擲骰。繼承原有文案時，實際指令仍會按原因、理智損失或成長情況選擇原有模板。',
    families: { standard: '標準檢定', bonus: '獎勵骰', penalty: '懲罰骰', brp: 'BRP 檢定', sanity: '理智檢定', growth: '成長檢定', psychology: '心理學暗骰', opposed: '對抗檢定', resist: 'BRP 抵抗', dnd_check: 'DND 檢定', death_save: '死亡豁免' },
    grades: { critical: '大成功', extreme: '極難成功', hard: '困難成功', regular: '成功', failure: '失敗', fumble: '大失敗', special: '特殊成功', tie: '平局' },
  },
  ja: {
    title: '結果別の返信', independent: 'この結果の返信を個別に設定', reset: '継承に戻す',
    inherited: '継承元：{{source}}', original: '元のコマンド文面', global: '全体', unavailable: '継承文面を取得できません。再読み込みしてください。',
    hint: '個別の結果返信 → 同段階の標準返信 → 元のコマンド文面。空欄は継承します。各結果で重み付き返信、入れ子の sample、人格を利用でき、実際に判定できる結果のみ表示します。',
    preview_hint: '選択した結果とサンプル値で表示し、実際のダイスは振りません。元の文面を継承する場合、理由・SAN 損失・成長の有無により元のテンプレートを使い分けます。',
    families: { standard: '標準判定', bonus: 'ボーナスダイス', penalty: 'ペナルティダイス', brp: 'BRP 判定', sanity: 'SAN 判定', growth: '成長判定', psychology: '心理学シークレット判定', opposed: '対抗判定', resist: 'BRP 抵抗', dnd_check: 'DND 判定', death_save: '死亡セーヴ' },
    grades: { critical: 'クリティカル', extreme: 'イクストリーム成功', hard: 'ハード成功', regular: '成功', failure: '失敗', fumble: 'ファンブル', special: '特殊成功', tie: '引き分け' },
  },
};
