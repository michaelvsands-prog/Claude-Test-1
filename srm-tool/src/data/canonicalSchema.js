import { normalize } from '../engine/normalize.js';

// Canonical attribute model per data type. Synonyms are written in raw
// vendor-flavored form for readability and normalized once at module load,
// so matching is an exact string comparison on normalized headers.
//
// `profile` (optional) names a value profiler in engine/profilers.js used to
// boost confidence when a column's sample values fit the expected pattern.

const RAW_SCHEMA = {
  Reference: [
    { id: 'isin', label: 'ISIN', profile: 'isin', synonyms: ['ISIN', 'ID_ISIN', 'ISIN Code', 'ISIN_CD', 'International Securities Identification Number'] },
    { id: 'cusip', label: 'CUSIP', profile: 'cusip', synonyms: ['CUSIP', 'ID_CUSIP', 'CUSIP Code', 'CUSIP_CD'] },
    { id: 'sedol', label: 'SEDOL', profile: 'sedol', synonyms: ['SEDOL', 'ID_SEDOL1', 'SEDOL1', 'SEDOL Code', 'SEDOL_CD'] },
    { id: 'figi', label: 'FIGI', synonyms: ['FIGI', 'ID_BB_GLOBAL', 'Bloomberg Global ID', 'BBGID', 'BBG ID'] },
    { id: 'ric', label: 'RIC', synonyms: ['RIC', 'Reuters Instrument Code', 'Refinitiv Identification Code', 'Reuters Code'] },
    { id: 'ticker', label: 'Ticker', synonyms: ['Ticker', 'Ticker Symbol', 'TKR', 'Trading Symbol', 'Symbol', 'Local Ticker'] },
    { id: 'issuerName', label: 'Issuer Name', synonyms: ['Issuer Name', 'ISSUER_NM', 'NAME', 'Company Name', 'Issuer', 'Name of Issuer'] },
    { id: 'securityDescription', label: 'Security Description', synonyms: ['Security Description', 'SECURITY_DES', 'SEC_DESC', 'Security Name', 'Long Description', 'Instrument Description'] },
    { id: 'securityType', label: 'Security Type', synonyms: ['Security Type', 'Instrument Type', 'SEC_TYP', 'SECURITY_TYP2', 'Product Type'] },
    { id: 'assetClass', label: 'Asset Class', synonyms: ['Asset Class', 'ASSET_CLS', 'Asset Category', 'Asset Type', 'MARKET_SECTOR_DES', 'Asset Group'] },
    { id: 'countryIncorporation', label: 'Country of Incorporation', profile: 'iso3166', synonyms: ['Country of Incorporation', 'CNTRY_OF_INCORPORATION', 'CNTRY_INC', 'Incorporation Country', 'Country Incorporated'] },
    { id: 'countryRisk', label: 'Country of Risk', profile: 'iso3166', synonyms: ['Country of Risk', 'CNTRY_OF_RISK', 'Risk Country', 'CNTRY_RISK'] },
    { id: 'currency', label: 'Currency', profile: 'iso4217', synonyms: ['Currency', 'CRNCY', 'Currency Code', 'CCY', 'Trading Currency', 'Denomination Currency'] },
    { id: 'exchangeMic', label: 'Exchange MIC', profile: 'mic', synonyms: ['Exchange MIC', 'MIC', 'MIC Code', 'ID_MIC_PRIM_EXCH', 'Market Identifier Code', 'EXCH_MIC_CD'] },
    { id: 'primaryExchange', label: 'Primary Exchange', synonyms: ['Primary Exchange', 'Exchange', 'Listing Exchange', 'PRIM_EXCH_NM', 'Exchange Name'] },
    { id: 'issueDate', label: 'Issue Date', profile: 'date', synonyms: ['Issue Date', 'ISSUE_DT', 'ISS_DT', 'Issuance Date', 'First Issue Date'] },
    { id: 'maturityDate', label: 'Maturity Date', profile: 'date', synonyms: ['Maturity Date', 'MATURITY', 'MAT_DT', 'Redemption Date', 'Final Maturity'] },
    { id: 'couponRate', label: 'Coupon Rate', profile: 'decimal', synonyms: ['Coupon Rate', 'CPN', 'CPN_RT', 'Coupon', 'Interest Rate', 'Fixed Rate'] },
    { id: 'couponFrequency', label: 'Coupon Frequency', synonyms: ['Coupon Frequency', 'CPN_FREQ', 'CPN_FREQ_CD', 'Payment Frequency', 'Interest Frequency'] },
    { id: 'dayCount', label: 'Day Count Convention', synonyms: ['Day Count Convention', 'DAY_CNT_DES', 'Day Count', 'DAY_CNT', 'Accrual Basis', 'Day Count Basis'] },
    { id: 'parValue', label: 'Par Value', profile: 'decimal', synonyms: ['Par Value', 'PAR_AMT', 'PAR_VAL', 'Face Value', 'Nominal Value', 'Face Amount'] },
    { id: 'issueAmount', label: 'Issue Amount', profile: 'decimal', synonyms: ['Issue Amount', 'Issued Amount', 'AMT_ISSUED', 'Original Issue Amount', 'Issue Size'] },
    { id: 'amountOutstanding', label: 'Amount Outstanding', profile: 'decimal', synonyms: ['Amount Outstanding', 'AMT_OUTSTANDING', 'Outstanding Amount', 'OUTSTD_AMT', 'Current Amount Outstanding'] },
    { id: 'seniority', label: 'Seniority', synonyms: ['Seniority', 'Payment Rank', 'Seniority Level', 'RANK', 'Capital Structure Rank'] },
    { id: 'callableFlag', label: 'Callable Flag', synonyms: ['Callable', 'Callable Flag', 'Is Callable', 'Call Indicator', 'CALLABLE_IND'] },
    { id: 'firstCouponDate', label: 'First Coupon Date', profile: 'date', synonyms: ['First Coupon Date', 'FIRST_CPN_DT', 'First Interest Date'] },
    { id: 'settlementDays', label: 'Settlement Days', synonyms: ['Settlement Days', 'PX_SETTLE_DAYS', 'Settlement Cycle', 'Days to Settlement', 'SETTLE_DAYS'] },
    { id: 'minDenomination', label: 'Minimum Denomination', profile: 'decimal', synonyms: ['Minimum Denomination', 'MIN_DENOM', 'Min Piece', 'Minimum Piece', 'MIN_PIECE'] },
    { id: 'securityStatus', label: 'Security Status', synonyms: ['Security Status', 'Status', 'SEC_STAT', 'Active Flag', 'Instrument Status'] },
    { id: 'valor', label: 'Valor Number', synonyms: ['Valor Number', 'Valor', 'VALOR_NUM', 'Swiss Valor', 'Valoren Number'] },
  ],
  Entity: [
    { id: 'lei', label: 'LEI', profile: 'lei', synonyms: ['LEI', 'Legal Entity Identifier', 'LEGAL_ENTITY_IDENTIFIER', 'LEI Code', 'LEI_CD'] },
    { id: 'legalName', label: 'Legal Name', synonyms: ['Legal Name', 'LEGAL_NM', 'Entity Name', 'Registered Name', 'Full Legal Name', 'Entity Legal Name'] },
    { id: 'shortName', label: 'Short Name', synonyms: ['Short Name', 'SHORT_NM', 'Common Name', 'Trade Name', 'Display Name'] },
    { id: 'ultimateParentLei', label: 'Ultimate Parent LEI', profile: 'lei', synonyms: ['Ultimate Parent LEI', 'ULT_PARENT_LEI', 'Ultimate Parent Legal Entity Identifier'] },
    { id: 'ultimateParentName', label: 'Ultimate Parent Name', synonyms: ['Ultimate Parent Name', 'ULT_PARENT_NM', 'Ultimate Parent', 'Global Ultimate Parent'] },
    { id: 'immediateParentLei', label: 'Immediate Parent LEI', profile: 'lei', synonyms: ['Immediate Parent LEI', 'IMM_PARENT_LEI', 'Direct Parent LEI'] },
    { id: 'countryDomicile', label: 'Country of Domicile', profile: 'iso3166', synonyms: ['Country of Domicile', 'CNTRY_DOM', 'Domicile', 'Domicile Country'] },
    { id: 'countryRegistration', label: 'Country of Registration', profile: 'iso3166', synonyms: ['Country of Registration', 'CNTRY_REG', 'Registration Country', 'Jurisdiction', 'Jurisdiction of Incorporation'] },
    { id: 'entityType', label: 'Entity Type', synonyms: ['Entity Type', 'Legal Form', 'ENTITY_TYP', 'Organization Type', 'Legal Structure'] },
    { id: 'registrationNumber', label: 'Registration Number', synonyms: ['Registration Number', 'REG_NUM', 'Company Registration Number', 'Business Registration Number', 'Company Number'] },
    { id: 'entityStatus', label: 'Entity Status', synonyms: ['Entity Status', 'Status', 'Operating Status', 'ENTITY_STAT', 'Active Status'] },
    { id: 'bic', label: 'SWIFT / BIC', synonyms: ['BIC', 'SWIFT Code', 'SWIFT BIC', 'Bank Identifier Code', 'SWIFT', 'BIC_CD'] },
  ],
  Pricing: [
    { id: 'price', label: 'Price', profile: 'decimal', synonyms: ['Price', 'PX', 'Current Price', 'Price Value', 'Evaluated Price'] },
    { id: 'bidPrice', label: 'Bid Price', profile: 'decimal', synonyms: ['Bid Price', 'BID', 'PX_BID', 'Bid'] },
    { id: 'askPrice', label: 'Ask Price', profile: 'decimal', synonyms: ['Ask Price', 'ASK', 'PX_ASK', 'Ask', 'Offer Price'] },
    { id: 'midPrice', label: 'Mid Price', profile: 'decimal', synonyms: ['Mid Price', 'PX_MID', 'Mid', 'Midpoint Price'] },
    { id: 'openPrice', label: 'Open Price', profile: 'decimal', synonyms: ['Open Price', 'PX_OPEN', 'Open', 'Opening Price'] },
    { id: 'highPrice', label: 'High Price', profile: 'decimal', synonyms: ['High Price', 'PX_HIGH', 'High', 'Day High'] },
    { id: 'lowPrice', label: 'Low Price', profile: 'decimal', synonyms: ['Low Price', 'PX_LOW', 'Low', 'Day Low'] },
    { id: 'closePrice', label: 'Close Price', profile: 'decimal', synonyms: ['Close Price', 'PX_LAST', 'Last Price', 'Closing Price', 'Close', 'Last'] },
    { id: 'priceDate', label: 'Price Date', profile: 'date', synonyms: ['Price Date', 'PX_DT', 'Pricing Date', 'As Of Date', 'Valuation Date'] },
    { id: 'priceSource', label: 'Price Source', synonyms: ['Price Source', 'PX_SRC', 'Pricing Source', 'Source', 'Quote Source'] },
    { id: 'priceCurrency', label: 'Price Currency', profile: 'iso4217', synonyms: ['Price Currency', 'PX_CRNCY', 'Quote Currency', 'Pricing Currency'] },
    { id: 'quoteType', label: 'Quote Type', synonyms: ['Quote Type', 'Price Type', 'Quotation Type', 'PX_TYP', 'Quote Basis'] },
    { id: 'factor', label: 'Factor', profile: 'decimal', synonyms: ['Factor', 'Price Factor', 'Pool Factor', 'Current Factor'] },
    { id: 'accruedInterest', label: 'Accrued Interest', profile: 'decimal', synonyms: ['Accrued Interest', 'ACC_INT', 'ACCR_INT', 'Accrued'] },
    { id: 'volume', label: 'Volume', profile: 'decimal', synonyms: ['Volume', 'PX_VOLUME', 'Trading Volume', 'VOL', 'Daily Volume'] },
  ],
  Sector: [
    { id: 'gicsSectorCode', label: 'GICS Sector Code', synonyms: ['GICS Sector Code', 'GICS_SECTOR_CD', 'GICS Sector Cd'] },
    { id: 'gicsSectorName', label: 'GICS Sector Name', synonyms: ['GICS Sector Name', 'GICS_SECTOR_NM', 'GICS Sector', 'GICS_SECTOR_DES'] },
    { id: 'gicsIndustryGroup', label: 'GICS Industry Group', synonyms: ['GICS Industry Group', 'GICS_IND_GRP_NM', 'GICS Industry Group Name'] },
    { id: 'gicsIndustryCode', label: 'GICS Industry Code', synonyms: ['GICS Industry Code', 'GICS_IND_CD'] },
    { id: 'gicsIndustryName', label: 'GICS Industry Name', synonyms: ['GICS Industry Name', 'GICS_IND_NM', 'GICS Industry'] },
    { id: 'icbIndustryCode', label: 'ICB Industry Code', synonyms: ['ICB Industry Code', 'ICB_IND_CD', 'ICB Code'] },
    { id: 'icbIndustryName', label: 'ICB Industry Name', synonyms: ['ICB Industry Name', 'ICB_IND_NM', 'ICB Industry'] },
    { id: 'trbcEconomicSector', label: 'TRBC Economic Sector', synonyms: ['TRBC Economic Sector', 'TRBC_ECON_SECTOR', 'TRBC Economic Sector Name'] },
    { id: 'trbcBusinessSector', label: 'TRBC Business Sector', synonyms: ['TRBC Business Sector', 'TRBC_BUS_SECTOR', 'TRBC Business Sector Name'] },
    { id: 'naicsCode', label: 'NAICS Code', synonyms: ['NAICS Code', 'NAICS', 'NAICS_CD'] },
    { id: 'sicCode', label: 'SIC Code', synonyms: ['SIC Code', 'SIC', 'SIC_CD'] },
  ],
};

// Normalize synonyms once at load so matching is exact-string on normalized forms.
export const CANONICAL_SCHEMA = Object.fromEntries(
  Object.entries(RAW_SCHEMA).map(([type, attrs]) => [
    type,
    attrs.map((attr) => ({
      ...attr,
      normLabel: normalize(attr.label),
      normSynonyms: [...new Set(attr.synonyms.map(normalize))],
    })),
  ])
);
