import { describe, expect, it, vi } from 'vitest';
import { createEmailMessage } from '../test/helpers/createEmailMessage';
import { email } from './email';

describe(email.name, async () => {
  // @ts-ignore -- defined in .env using vitest-environment-miniflare
  const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1234567890/abcdefghijklmnopqrstuvwxyz';

  // Disable Fetch API from making real network requests
  const fetchMock = getMiniflareFetchMock();
  fetchMock.disableNetConnect();

  // Intercept calls to Discord's webhook API
  const origin = fetchMock.get('https://discord.com');
  origin
    .intercept({ method: 'POST', path: /api\/webhooks\/.*/ })
    .reply(200, 'Discord is happy in this Mock!')
    .persist();

  it('handles a test email', async () => {
    // Arrange
    const message: EmailMessage = await createEmailMessage();

    // Act
    const call = email(message, { DISCORD_WEBHOOK_URL });

    // Assert
    await expect(call).resolves.toBeUndefined();
  });

  it('does not leave open connections', async () => {
    // Arrange
    const message: EmailMessage = await createEmailMessage();

    // Act
    await email(message, { DISCORD_WEBHOOK_URL });

    // Assert
    fetchMock.assertNoPendingInterceptors();
  });

  it('uses the webhook url', async () => {
    // Arrange
    const fetchSpy = vi.spyOn(global, 'fetch');
    const message: EmailMessage = await createEmailMessage();

    // Act
    await email(message, { DISCORD_WEBHOOK_URL });

    // Assert
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(DISCORD_WEBHOOK_URL, expect.anything());
  });

  it('correctly passes the body to the webhook', async () => {
    // Arrange
    const fetchSpy = vi.spyOn(global, 'fetch');
    const message: EmailMessage = await createEmailMessage({ body: 'Hello\nI have a question\nBye!' });

    // Act
    await email(message, { DISCORD_WEBHOOK_URL });

    // Assert
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ 
        body: expect.stringContaining('embeds') 
      }),
    );
  });

  it('splits long bodies over multiple calls', async () => {
    // Arrange
    const fetchSpy = vi.spyOn(global, 'fetch');
    const message: EmailMessage = await createEmailMessage({
      from: 'sender@example.com',
      to: 'recipient@examples.com',
      subject: 'Question about foo',
      body:
        'Attack feet behind the couch destroy couch flop over give attitude hide when guests come over hopped up on goofballs hunt anything that moves bag stretch swat at dog all of a sudden go crazy flop over leave dead animals as gifts  stand in front of the computer screen   rub face on everything  claw drapes lick butt intently stare at the same spot,  intrigued by the shower chase mice why must they do that make muffins attack feet make muffins leave dead animals as gifts give attitude why must they do that flop over  stand in front of the computer screen  hide when guests come over all of a sudden go crazy  claw drapes bag stretch hopped up on goofballs. Flop over why must they do that swat at dog hopped up on goofballs  claw drapes attack feet lick butt behind the couch hide when guests come over hunt anything that moves, flop over  rub face on everything all of a sudden go crazy  intrigued by the shower chase mice make muffins give attitude leave dead animals as gifts destroy couch  stand in front of the computer screen , bag stretch intently stare at the same spot behind the couch chase mice give attitude make muffins  intrigued by the shower destroy couch. Hunt anything that moves swat at dog lick butt hide when guests come over give attitude bag stretch flop over all of a sudden go crazy chase mice,  stand in front of the computer screen  leave dead animals as gifts hopped up on goofballs make muffins intently stare at the same spot flop over  rub face on everything,  claw drapes  intrigued by the shower destroy couch behind the couch attack feet why must they do that lick butt. Give attitude bag stretch hide when guests come over hunt anything that moves behind the couch make muffins flop over swat at dog leave dead animals as gifts, intently stare at the same spot  stand in front of the computer screen  lick butt  intrigued by the shower all of a sudden go crazy destroy couch. Flop over flop over intently stare at the same spot bag stretch behind the couch destroy couch hunt anything that moves  rub face on everything  claw drapes, lick butt hide when guests come over  stand in front of the computer screen  swat at dog attack feet give attitude  intrigued by the shower hopped up on goofballs, all of a sudden go crazy make muffins leave dead animals as gifts why must they do that chase mice hide when guests come over swat at dog.\n' +
        '\n' +
        'Leave dead animals as gifts behind the couch why must they do that give attitude hunt anything that moves  rub face on everything swat at dog attack feet  claw drapes lick butt, flop over destroy couch chase mice all of a sudden go crazy intently stare at the same spot make muffins hopped up on goofballs flop over.\n' +
        '\n' +
        'Give attitude attack feet behind the couch make muffins leave dead animals as gifts flop over intently stare at the same spot  stand in front of the computer screen  swat at dog hopped up on goofballs  intrigued by the shower bag stretch, destroy couch  rub face on everything chase mice lick butt flop over hunt anything that moves hide when guests come over  claw drapes why must they do that all of a sudden go crazy bag stretch swat at dog, hunt anything that moves chase mice  rub face on everything destroy couch all of a sudden go crazy intently stare at the same spot flop over  stand in front of the computer screen  behind the couch hopped up on goofballs.  claw drapes lick butt  stand in front of the computer screen  chase mice leave dead animals as gifts give attitude hunt anything that moves  intrigued by the shower hide when guests come over swat at dog intently stare at the same spot flop over  rub face on everything, why must they do that attack feet bag stretch behind the couch flop over hopped up on goofballs make muffins all of a sudden go crazy destroy couch  intrigued by the shower chase mice. Make muffins chase mice flop over attack feet flop over swat at dog  stand in front of the computer screen  bag stretch  rub face on everything hunt anything that moves all of a sudden go crazy leave dead animals as gifts  claw drapes, destroy couch  intrigued by the shower hide when guests come over why must they do that give attitude intently stare at the same spot behind the couch hopped up on goofballs lick butt  stand in front of the computer screen . Destroy couch hide when guests come over attack feet give attitude flop over lick butt hopped up on goofballs  rub face on everything, why must they do that swat at dog  intrigued by the shower flop over intently stare at the same spot.',
    });

    // Act
    await email(message, { DISCORD_WEBHOOK_URL });

    // Assert
    expect(fetchSpy).toHaveBeenCalledTimes(2); // С embeds обычно требуется меньше вызовов из-за более высокого лимита символов
    fetchMock.assertNoPendingInterceptors();
  });

  it("throws immediately if the webhook url isn't set", async () => {
    // Arrange
    const message: EmailMessage = await createEmailMessage();

    // Act
    const call = email(message, { DISCORD_WEBHOOK_URL: undefined });

    // Assert
    await expect(call).rejects.toThrow('Missing DISCORD_WEBHOOK_URL');
  });

  it('reflects when no subject was given', async () => {
    // Arrange
    const fetchSpy = vi.spyOn(global, 'fetch');
    const message: EmailMessage = await createEmailMessage({ subject: '' });

    // Act
    const call = email(message, { DISCORD_WEBHOOK_URL });

    // Assert
    await expect(call).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ 
        body: expect.stringContaining('(no subject)') 
      }),
    );
  });

  it('reports errors', async () => {
    // Arrange
    const message: EmailMessage = await createEmailMessage();
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementationOnce(() => {
      throw new Error('Something unexpected');
    });

    // Act
    const invocation = email(message, { DISCORD_WEBHOOK_URL });
    const calls = fetchSpy.mock.calls;

    // Assert
    await expect(invocation).resolves.toBeUndefined();
    expect(fetchSpy.mock.calls[1][1].body).toContain('errorEmbed');
    expect(fetchSpy.mock.calls[1][1].body).toContain('Something unexpected');
  });

  it('reports an error if the response is not ok', async () => {
    // Arrange
    const message: EmailMessage = await createEmailMessage();
    // @ts-ignore
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementationOnce(() => {
      return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve('Something unexpected') });
    });

    // Act
    const invocation = email(message, { DISCORD_WEBHOOK_URL });

    // Assert
    await expect(invocation).resolves.toBeUndefined();
    expect(fetchSpy.mock.calls[1][1].body).toContain('errorEmbed');
    expect(fetchSpy.mock.calls[1][1].body).toContain('Something unexpected');
  });

  it('throws if the error can not be reported', async () => {
    // Arrange
    const message: EmailMessage = await createEmailMessage();
    // @ts-ignore
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(() => {
      return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve('Something unexpected') });
    });

    // Act
    const invocation = email(message, { DISCORD_WEBHOOK_URL });

    // Assert
    await expect(invocation).rejects.toThrow('Failed to post error to Discord webhook.');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('correctly processes HTML version of email', async () => {
    // Arrange
    const fetchSpy = vi.spyOn(global, 'fetch');
    
    // Создаем HTML-содержимое
    const htmlBody = '<h1>Заголовок письма</h1><p>Это <strong>тестовое</strong> письмо с <em>HTML</em> разметкой.</p>';
    
    // Подготавливаем mock для функции parseRawEmail
    const originalExtract = require('letterparser').extract;
    const extractMock = vi.fn().mockImplementation((rawEmail) => {
      const result = originalExtract(rawEmail);
      // Добавляем HTML-версию
      result.html = htmlBody;
      return result;
    });
    
    // Временно подменяем функцию extract
    require('letterparser').extract = extractMock;
    
    const message: EmailMessage = await createEmailMessage({ 
      body: 'Текстовая версия письма'
    });

    // Act
    await email(message, { DISCORD_WEBHOOK_URL });

    // Восстанавливаем оригинальную функцию
    require('letterparser').extract = originalExtract;

    // Assert
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    
    // Проверяем, что в Discord отправлен HTML-контент
    const callArgs = fetchSpy.mock.calls[0][1];
    const body = JSON.parse(callArgs.body);
    
    expect(body.embeds[0].description).toBe(htmlBody);
    expect(body.embeds[0].fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Content Type',
          value: 'HTML',
        })
      ])
    );
  });
});
