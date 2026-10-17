/** Producto 25N1: the third-party notices that ship in the binary, for Ajustes › Licencias. Pure data, so Node tests read
 * it: tests/licenses.node.ts checks every production dependency against a notice, each listed package's LICENSE file
 * against its text, the Unicode text against LICENSES/Unicode-3.0.txt and circle-flags' against src/i18n/flag-art.ts.
 *
 * A notice's name, licence and text are shown as published, in English, in every interface language (the legal text is
 * the licence; a translation would not be). Only the screen's own words are in the catalogue. The text is kept as its
 * paragraphs: the published files wrap at 80 columns, which a phone reflows anyway.
 *
 * ponytail: the list covers the direct production dependencies and the embedded data (Ionicons, circle-flags, CLDR);
 * the packages they pull in transitively are not listed one by one. A generated list (a `licenses:generate` script
 * checked in CI, like currency:generate) is the upgrade when the release needs every transitive notice. */
export type LicenseNotice = {
  /** The route's id: /license/[id]. */
  id: string;
  name: string;
  /** The licence's own name. */
  licence: string;
  /** Software the app runs, or data and artwork compiled into it. */
  group: 'software' | 'data';
  /** The npm packages the notice covers, as package.json names them; empty for data copied into the source. */
  packages: readonly string[];
  paragraphs: readonly string[];
};

const MIT_BODY = [
  'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:',
  'The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.',
  'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.',
] as const;

/** An MIT notice as its file reads: its heading (the two spellings packages use), the copyright lines, the shared body. */
const mit = (id: string, name: string, heading: 'MIT License' | 'The MIT License (MIT)', copyright: readonly string[], packages: readonly string[],
  group: LicenseNotice['group'] = 'software'): LicenseNotice => ({ id, name, licence: 'MIT', group, packages, paragraphs: [heading, ...copyright, ...MIT_BODY] });

const EXPO_MODULES = ['expo', 'expo-constants', 'expo-crypto', 'expo-dev-client', 'expo-file-system', 'expo-font', 'expo-glass-effect', 'expo-haptics',
  'expo-linking', 'expo-localization', 'expo-router', 'expo-sharing', 'expo-splash-screen', 'expo-sqlite', 'expo-status-bar', 'expo-system-ui'];

export const LICENSE_NOTICES: readonly LicenseNotice[] = [
  mit('react-native', 'React Native', 'MIT License', ['Copyright (c) Meta Platforms, Inc. and affiliates.'], ['react', 'react-native']),
  mit('expo', 'Expo', 'The MIT License (MIT)', ['Copyright (c) 2015-present 650 Industries, Inc. (aka Expo)'], EXPO_MODULES),
  mit('vector-icons', '@expo/vector-icons', 'The MIT License (MIT)', ['Copyright (c) 2015 Joel Arvidsson', 'Copyright (c) 2020 650 Industries'], ['@expo/vector-icons']),
  // The icon font @expo/vector-icons embeds (the only one the app loads); its notice is the ionicons repository's.
  mit('ionicons', 'Ionicons', 'The MIT License (MIT)', ['Copyright (c) 2015-present Ionic (http://ionic.io/)'], []),
  mit('reanimated', 'React Native Reanimated · Gesture Handler', 'The MIT License (MIT)', ['Copyright (c) 2016 Software Mansion <swmansion.com>'],
    ['react-native-reanimated', 'react-native-gesture-handler']),
  mit('screens', 'React Native Screens', 'The MIT License (MIT)', ['Copyright (c) 2018 Software Mansion <swmansion.com>'], ['react-native-screens']),
  mit('worklets', 'React Native Worklets', 'MIT License', ['Copyright (c) 2024 nobody'], ['react-native-worklets']),
  mit('safe-area', 'React Native Safe Area Context', 'MIT License', ['Copyright (c) 2019 Th3rd Wave'], ['react-native-safe-area-context']),
  mit('svg', 'React Native SVG', 'The MIT License (MIT)', ['Copyright (c) [2015-2016] [Horcrux]'], ['react-native-svg']),
  mit('datetimepicker', 'DateTimePicker', 'MIT License', ['Copyright (c) 2019 React Native Community'], ['@react-native-community/datetimepicker']),
  mit('decode-uri-component', 'decode-uri-component', 'The MIT License (MIT)',
    ['Copyright (c) 2017, Sam Verschueren <sam.verschueren@gmail.com> (github.com/SamVerschueren)'], ['safe-decode-uri-component']),
  // The round flags (src/i18n/flag-art.ts, generated from circle-flags 2.8.3).
  mit('circle-flags', 'circle-flags', 'MIT License', ['Copyright (c) 2026 HatScripts'], [], 'data'),
  // The region and currency catalogues (src/i18n/regions/, src/i18n/currencies/, CLDR 48.2.0); LICENSES/Unicode-3.0.txt.
  { id: 'cldr', name: 'Unicode CLDR', licence: 'Unicode License v3', group: 'data', packages: [], paragraphs: [
    'UNICODE LICENSE V3',
    'COPYRIGHT AND PERMISSION NOTICE',
    'Copyright © 2015-2024 Unicode, Inc.',
    'NOTICE TO USER: Carefully read the following legal agreement. BY DOWNLOADING, INSTALLING, COPYING OR OTHERWISE USING DATA FILES, AND/OR SOFTWARE, YOU UNEQUIVOCALLY ACCEPT, AND AGREE TO BE BOUND BY, ALL OF THE TERMS AND CONDITIONS OF THIS AGREEMENT. IF YOU DO NOT AGREE, DO NOT DOWNLOAD, INSTALL, COPY, DISTRIBUTE OR USE THE DATA FILES OR SOFTWARE.',
    'Permission is hereby granted, free of charge, to any person obtaining a copy of data files and any associated documentation (the "Data Files") or software and any associated documentation (the "Software") to deal in the Data Files or Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, and/or sell copies of the Data Files or Software, and to permit persons to whom the Data Files or Software are furnished to do so, provided that either (a) this copyright and permission notice appear with all copies of the Data Files or Software, or (b) this copyright and permission notice appear in associated Documentation.',
    'THE DATA FILES AND SOFTWARE ARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF THIRD PARTY RIGHTS.',
    'IN NO EVENT SHALL THE COPYRIGHT HOLDER OR HOLDERS INCLUDED IN THIS NOTICE BE LIABLE FOR ANY CLAIM, OR ANY SPECIAL INDIRECT OR CONSEQUENTIAL DAMAGES, OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THE DATA FILES OR SOFTWARE.',
    'Except as contained in this notice, the name of a copyright holder shall not be used in advertising or otherwise to promote the sale, use or other dealings in these Data Files or Software without prior written authorization of the copyright holder.',
    'SPDX-License-Identifier: Unicode-3.0',
  ] },
];

export const licenseNotice = (id: string | undefined) => LICENSE_NOTICES.find(notice => notice.id === id);
