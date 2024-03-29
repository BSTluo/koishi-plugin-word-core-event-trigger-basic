import { Bot, Context, Schema, Session, h } from 'koishi';
import { } from 'koishi-plugin-word-core';
import { CronJob } from 'cron';

export const name = 'word-core-event-trigger-basic';

export interface Config { }

export const Config: Schema<Config> = Schema.object({});

export const inject = ['word'];

export async function apply(ctx: Context) {
  // write your plugin here
  // ctx.command('test').action(_=>{
  //   ctx.bots.forEach((e: Bot) => {
  //     console.log(e.session())
  //   });
  // })

  const nowList = {};

  ctx.command('word', '词库核心！').subcommand('.newtimer <triggerWord:string> <timer:string> <time:number>', '设置一个时间触发词')
    .example('word.newTimer 每30秒 "30 * * * * *"')
    .usage([
      '当到达对应的时间规则时，会触发一个词库的触发词',
      '时间规则：https://www.jianshu.com/p/02ae7bc3fc43'
    ].join('\n'))
    .action(async ({ session }, triggerWord, timer, time) => {
      if (!session) { return; }
      if (!triggerWord) { return `<at name="${session.username}" /> 你没有输入触发词`; }
      if (!timer) { return `<at name="${session.username}" /> 你没有输入corn时间规则`; }

      let timeNumber = (time) ? time : 1;

      const list = await ctx.word.config.getConfig('cornConfigList');
      if (!list[timer]) { list[timer] = {}; }

      list[timer][triggerWord] = { time: timeNumber, channelId: session.channelId };

      await ctx.word.config.updateConfig('cornConfigList', list);

      // return session.send(`<at name="${session.username}" /> 保存完成，触发次数${timeNumber}`);

      const job = new CronJob(timer, async () => {
        timeNumber--;

        if (timeNumber == 0)
        {
          job.stop();
          delete list[timer][triggerWord];
          if (JSON.stringify(timer) == '{}') { delete list[timer]; }
        }

        const a = await ctx.word.driver.start({
          username: timer,
          userId: triggerWord,
          channelId: session.channelId, // 后面从词库获取罢
          content: triggerWord
        });
        ctx.bots.forEach((e: Bot) => {
          e.sendMessage(session.channelId, a);
        });

        await ctx.word.config.updateConfig('cornConfigList', list);

      }, null, true);

      nowList[`${triggerWord}[${timer}]`] = job;

      return `<at name="${session.username}" /> 保存完成，触发次数${timeNumber}`;
    });

  ctx.command('word', '词库核心！').subcommand('.stoptimer <triggerWord:string> <timer:string>', '清除一个时间触发词')
    .example('word.stopTimer 每30秒 "30 * * * * *"')
    .usage([
      '删除一个触发器',
      '时间规则：https://www.jianshu.com/p/02ae7bc3fc43'
    ].join('\n'))
    .action(async ({ session }, triggerWord, timer) => {
      if (!session) { return; }
      if (!triggerWord) { return `<at name="${session.username}" /> 你没有输入触发词`; }
      if (!timer) { return `<at name="${session.username}" /> 你没有输入corn时间规则`; }

      const list = await ctx.word.config.getConfig('cornConfigList');
      if (!list[timer]) { return `<at name="${session.username}" /> 此配置为空`; }

      if (!list[timer].hasOwnProperty(triggerWord)) { return `<at name="${session.username}" /> 不存在选择的此触发词`; }
      delete list[timer][triggerWord];

      await ctx.word.config.updateConfig('cornConfigList', list);

      if (nowList[`${triggerWord}[${timer}]`])
      {
        const job = nowList[`${triggerWord}[${timer}]`];
        job.stop();
        delete nowList[`${triggerWord}[${timer}]`];
      }

      return `<at name="${session.username}" /> 保存完成`;
    });

  ctx.command('word', '词库核心！').subcommand('.listtimer', '查询所有的触发器')
    .example('word.listtimer')
    .action(async ({ session }, triggerWord, timer) => {
      let msg = '';
      let num = 0;

      Object.keys(nowList).forEach(key => {
        const matchList = key.match(/([\s\S]+)\[([\s\S]+)\]/);
        const triggerWord = (matchList[1]) ? matchList[1] : '';
        const timer = (matchList[2]) ? matchList[2] : '';

        msg += `${num}. ${triggerWord} : ${timer}`;
      });

      return `<at name="${session.username}" /> 当前列表：` + h.text(msg);
    });

  const timerTriggerConfig = await ctx.word.config.getConfig('cornConfigList');

  for (let rule in timerTriggerConfig as Object)
  {
    for (let q in timerTriggerConfig[rule])
    {
      let time = timerTriggerConfig[rule][q].time;
      let channelId = timerTriggerConfig[rule][q].channelId;

      const job = new CronJob(rule, async () => {
        time--;

        if (time == 0)
        {
          job.stop();
          delete timerTriggerConfig[rule][q];
          if (JSON.stringify(rule) == '{}') { delete timerTriggerConfig[rule]; }
        }

        const a = await ctx.word.driver.start({
          username: rule,
          userId: q,
          channelId: channelId, // 后面从词库获取罢
          content: q
        });

        ctx.bots.forEach((e: Bot) => {
          e.sendMessage(channelId, a);
        });

        await ctx.word.config.updateConfig('cornConfigList', timerTriggerConfig);
      }, null, true);

      nowList[`${q}[${rule}]`] = job;
    }
  }
}
