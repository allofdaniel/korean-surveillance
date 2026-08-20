import zlib from 'zlib';

/**
 * AMHS IPM XML & SOAP Generator
 * 과제 인터페이스 요구사항 준수:
 * - METAR, TAF, SIGMET (AMHS IPM XML / IA5 Text)
 * - NOTAM, DEP, ARR, CNL, DLA (AMHS SOAP receiveAmhsMessageRequest)
 * - IWXXM (FTBP Gzip binary octet-aligned)
 * - IPN / NDR Report (SOAP NonDeliveryReport)
 */

/**
 * 현재 시각 기반 Filing Time (DDHHMM) 및 Message ID 생성
 */
export function getAtsFilingTime(date = new Date()) {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  const m = String(date.getUTCMinutes()).padStart(2, '0');
  return `${d}${h}${m}`;
}

export function generateUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 1. AMHS IPM XML (X.400 / AIDA-NG 표준 형식)
 * 대상: METAR (NO.9), TAF (NO.10), SIGMET (NO.11), FPL (NO.14), CHG (NO.15)
 */
export function generateAmhsIpmXml({
  locId = 'LOC-ID:00E316AF1B779727',
  originator = {
    c: 'XX',
    a: 'ICAO',
    p: 'REP-KOREA',
    o: 'RKSS',
    ou: 'RKSI',
    cn: 'RKSIYPYX'
  },
  recipients = [
    { c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: 'RKSI', cn: 'RKSIYPYX' }
  ],
  priority = 'FF',
  filingTime = getAtsFilingTime(),
  headerLine = '',
  atsMessage = '',
}) {
  const recipientsXml = recipients.map(r => `
        <PrimaryRecipientsSubfield>
          <formal-name>
            <C>${r.c || 'XX'}</C>
            <A>${r.a || 'ICAO'}</A>
            <P>${r.p || 'REP-KOREA'}</P>
            <O>${r.o || 'RKSS'}</O>
            <OU>${r.ou || 'RKSI'}</OU>
            <ExtensionAttribute extension-attribute-type="1">
              <CN>${r.cn || 'RKSIYPYX'}</CN>
            </ExtensionAttribute>
          </formal-name>
        </PrimaryRecipientsSubfield>`).join('');

  return `<?xml version="1.0"?>
<Content>
  <ipm>
    <heading>
      <this-IPM>
        <user>
          <C>${originator.c || 'XX'}</C>
          <A>${originator.a || 'ICAO'}</A>
          <P>${originator.p || 'REP-KOREA'}</P>
          <O>${originator.o || 'RKSS'}</O>
          <OU>${originator.ou || 'RKSI'}</OU>
          <ExtensionAttribute extension-attribute-type="1">
            <CN>${originator.cn || 'RKSIYPYX'}</CN>
          </ExtensionAttribute>
        </user>
        <user-relative-identifier>${locId}</user-relative-identifier>
      </this-IPM>
      <originator>
        <formal-name>
          <C>${originator.c || 'XX'}</C>
          <A>${originator.a || 'ICAO'}</A>
          <P>${originator.p || 'REP-KOREA'}</P>
          <O>${originator.o || 'RKSS'}</O>
          <OU>${originator.ou || 'RKSI'}</OU>
          <ExtensionAttribute extension-attribute-type="1">
            <CN>${originator.cn || 'RKSIYPYX'}</CN>
          </ExtensionAttribute>
        </formal-name>
      </originator>
      <primary-recipients>${recipientsXml}
      </primary-recipients>
    </heading>
    <body>
      <BodyPart>
        <ia5-text>
          <parameters repertoire="ia5"/>
          <data><soh/>PRI: ${priority}&#xD;
FT: ${filingTime}&#xD;
${headerLine ? `<stx/>${headerLine}&#xD;\n` : '<stx/>'}${atsMessage}&#xD;
&#xD;
</data>
        </ia5-text>
      </BodyPart>
    </body>
  </ipm>
</Content>`;
}

/**
 * 2. AMHS SOAP XML (receiveAmhsMessageRequest Envelope)
 * 대상: NOTAM (NO.13), CNL (NO.16), DLA (NO.17), DEP (NO.18), ARR (NO.19)
 */
export function generateAmhsSoapXml({
  messageId = `0002${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}0001`,
  userRelId = '00E3185926867A1F',
  originatorCn = 'RKSSKALP',
  recipientCn = 'RKSSKAUA',
  priority = 'GG',
  filingTime = getAtsFilingTime(),
  atsMessageText = '',
}) {
  const uuid = generateUuid();
  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
    <wsa:Action>http://www.comsoft.aero/aida-ng/AIDA-NG-ServiceInterface/receiveAmhsMessageRequest</wsa:Action>
    <wsa:From><wsa:Address>http://100.1.1.82:9090/aida-ng/ws/aida-ng</wsa:Address></wsa:From>
    <wsa:MessageID>urn:uuid:${uuid}</wsa:MessageID>
  </soapenv:Header>
  <soapenv:Body>
    <n:receiveAmhsMessageResponse xmlns:n="http://www.comsoft.aero/aida-ng/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <messageId>${messageId}</messageId>
      <amhsMessageDelivery xsi:type="amhsMessageDeliveryType">
        <ipm xsi:type="ipmType">
          <heading xsi:type="headingType">
            <thisIpm xsi:type="ipmIdentifierType">
              <userRelativeIdentifier>${userRelId}</userRelativeIdentifier>
              <user xsi:type="orNameType">
                <address xsi:type="orAddressType">
                  <countryName xsi:type="countryNameType"><iso3166Alpha2Code>XX</iso3166Alpha2Code></countryName>
                  <administrationDomainName>ICAO</administrationDomainName>
                  <privateDomainName>REP-KOREA</privateDomainName>
                  <organizationName>RKSS</organizationName>
                  <organizationalUnitNames xsi:type="organizationalUnitNamesType"><organizationalUnitName>RKSS</organizationalUnitName></organizationalUnitNames>
                  <commonName>${originatorCn}</commonName>
                </address>
              </user>
            </thisIpm>
            <originator xsi:type="orNameType">
              <address xsi:type="orAddressType">
                <countryName xsi:type="countryNameType"><iso3166Alpha2Code>XX</iso3166Alpha2Code></countryName>
                <administrationDomainName>ICAO</administrationDomainName>
                <privateDomainName>REP-KOREA</privateDomainName>
                <organizationName>RKSS</organizationName>
                <organizationalUnitNames xsi:type="organizationalUnitNamesType"><organizationalUnitName>RKSS</organizationalUnitName></organizationalUnitNames>
                <commonName>${originatorCn}</commonName>
              </address>
            </originator>
            <primaryRecipients xsi:type="orNameListType">
              <orName xsi:type="orNameType">
                <address xsi:type="orAddressType">
                  <countryName xsi:type="countryNameType"><iso3166Alpha2Code>XX</iso3166Alpha2Code></countryName>
                  <administrationDomainName>ICAO</administrationDomainName>
                  <privateDomainName>REP-KOREA</privateDomainName>
                  <organizationName>RKSS</organizationName>
                  <organizationalUnitNames xsi:type="organizationalUnitNamesType"><organizationalUnitName>RKSS</organizationalUnitName></organizationalUnitNames>
                  <commonName>${recipientCn}</commonName>
                </address>
              </orName>
            </primaryRecipients>
            <subject/>
            <priority>${priority}</priority>
            <filingTime>${filingTime}</filingTime>
          </heading>
          <body xsi:type="bodyType">
            <bodyPart xsi:type="bodyPartType">
              <atsMessageText>${atsMessageText}</atsMessageText>
            </bodyPart>
          </body>
        </ipm>
      </amhsMessageDelivery>
    </n:receiveAmhsMessageResponse>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * 3. IWXXM Binary FTBP Gzip (NO.12)
 */
export function generateIwxxmAmhsXml({
  rawXml,
  fileName = `A_LAMS31RKSI${getAtsFilingTime()}00_C_RKSI_${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}.xml.gz`,
}) {
  const gzippedBuffer = zlib.gzipSync(Buffer.from(rawXml || '<iwxxm:TAF/>', 'utf-8'));
  const hexEncoded = gzippedBuffer.toString('hex').toUpperCase();

  return `<?xml version="1.0"?>
<Content>
  <ipm>
    <heading>
      <this-IPM>
        <user>
          <C>XX</C><A>ICAO</A><P>REP-KOREA</P><O>RKSS</O><OU>RKSI</OU>
          <ExtensionAttribute extension-attribute-type="1"><CN>RKSIYPYX</CN></ExtensionAttribute>
        </user>
        <user-relative-identifier>${getAtsFilingTime()}.12634</user-relative-identifier>
      </this-IPM>
      <originator>
        <formal-name>
          <C>XX</C><A>ICAO</A><P>REP-KOREA</P><O>RKSS</O><OU>RKSI</OU>
          <ExtensionAttribute extension-attribute-type="1"><CN>RKSIYPYX</CN></ExtensionAttribute>
        </formal-name>
      </originator>
      <primary-recipients>
        <PrimaryRecipientsSubfield>
          <formal-name>
            <C>XX</C><A>ICAO</A><P>REP-KOREA</P><O>RKSS</O><OU>RKSI</OU>
            <ExtensionAttribute extension-attribute-type="1"><CN>RKSIYMYX</CN></ExtensionAttribute>
          </formal-name>
        </PrimaryRecipientsSubfield>
      </primary-recipients>
      <subject>IWXXM_MET</subject>
    </heading>
    <body>
      <BodyPart>
        <parameters>
          <type-id>2.6.1.11.12</type-id>
          <value>
            <FileTransferParameters>
              <contents-type><document-type><document-type-name>1.0.8571.5.3</document-type-name></document-type></contents-type>
              <file-attributes>
                <pathname><incomplete-pathname><GraphicString>${fileName}</GraphicString></incomplete-pathname></pathname>
                <object-size><actual-values>${gzippedBuffer.length}</actual-values></object-size>
              </file-attributes>
            </FileTransferParameters>
          </value>
        </parameters>
        <data>
          <type-id>2.6.1.4.12</type-id>
          <value>
            <FileTransferData>
              <SEQUENCE>
                <direct-reference>1.0.8571.5.3</direct-reference>
                <encoding><octet-aligned>${hexEncoded}</octet-aligned></encoding>
              </SEQUENCE>
            </FileTransferData>
          </value>
        </data>
      </BodyPart>
    </body>
  </ipm>
</Content>`;
}
