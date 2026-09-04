/* §69の検査が、重要な契約を壊したとき本当に赤になることを確認する。 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const source = fs.readFileSync(path.join(__dirname, 'p2_data.js'), 'utf8');
const gameSource = fs.readFileSync(path.join(__dirname, 'p3_game.js'), 'utf8');
const mutations = [
  {
    name:'S15を簡単案件から外す',
    from:"id:'S15', arrive:86, name:'岡田 真理', nameEn:'Mari Okada', age:38, ageRange:[28,48], type:'novice', abandonAfter:30, callbackTo:'hotel', stayDays:2, difficulty:'easy',",
    to:"id:'S15', arrive:86, name:'岡田 真理', nameEn:'Mari Okada', age:38, ageRange:[28,48], type:'novice', abandonAfter:30, callbackTo:'hotel', stayDays:2, difficulty:'hard',",
    expected:'追加案件にeasy指定がない',
  },
  {
    name:'S18の安全操作を未復旧にする',
    from:"fact:{text:'BluetoothテザリングをOFFにするとWi-Fiが復帰した',hot:['device_net'],out:['fup','devices','geo_block','heavy','device_side','location','power','carrier','coverage','sim','hardware','provision','logistics']},solves:true",
    to:"fact:{text:'BluetoothテザリングをOFFにするとWi-Fiが復帰した',hot:['device_net'],out:['fup','devices','geo_block','heavy','device_side','location','power','carrier','coverage','sim','hardware','provision','logistics']},solves:false",
    expected:'安全操作で復旧を確認できない',
  },
  {
    name:'S24の正解から安全操作の前提を外す',
    from:"trueCause:'device_net',best:'r_airplane_off',partial:[],",
    to:"trueCause:'device_net',best:'r_vpn_off',partial:[],",
    expected:'正解対処に安全操作の前提がない',
  },
  {
    name:'同じ原因内の別案件用対処を再び成功させる',
    file:'p3_game.js',
    from:'const scenarioRemedyMatched = !causeMatched || remedyMatchesScenario(s, remedyId);',
    to:'const scenarioRemedyMatched = true;',
    expected:'同じ原因の別案件用対処',
  },
];

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wifi-simple-case-'));
try {
  mutations.forEach((mutation, index) => {
    const targetSource = mutation.file === 'p3_game.js' ? gameSource : source;
    assert.equal(targetSource.split(mutation.from).length - 1, 1, mutation.name + ': 変更対象が一意でない');
    const mutatedPath = path.join(temporaryRoot, 'p2_data-' + index + '.js');
    const mutatedGamePath = path.join(temporaryRoot, 'p3_game-' + index + '.js');
    fs.writeFileSync(mutatedPath, mutation.file === 'p3_game.js' ? source : targetSource.replace(mutation.from, mutation.to));
    fs.writeFileSync(mutatedGamePath, mutation.file === 'p3_game.js' ? targetSource.replace(mutation.from, mutation.to) : gameSource);
    const result = spawnSync(process.execPath, [path.join(__dirname, 'simple_case_test.js'), mutatedPath, mutatedGamePath], {encoding:'utf8'});
    const output = result.stdout + result.stderr;
    assert.notEqual(result.status, 0, mutation.name + ': 壊しても検査が成功した');
    assert(output.includes(mutation.expected), mutation.name + ': 期待した理由で失敗しなかった\n' + output);
  });
} finally {
  fs.rmSync(temporaryRoot, {recursive:true,force:true});
}

console.log('簡単案件の否定検査: 4変異を検出');
