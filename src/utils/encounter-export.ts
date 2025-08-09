import { PDFDocument, PDFTextField, StandardFonts } from 'pdf-lib';
import { Encounter } from '../models/encounter';

import encounterSheet from '../assets/encounter-sheet.pdf';
import { EncounterLogic } from '../logic/encounter-logic';
import { Sourcebook } from '../models/sourcebook';
import { SourcebookLogic } from '../logic/sourcebook-logic';
import { MonsterLogic } from '../logic/monster-logic';
import { MonsterOrganizationType } from '../enums/monster-organization-type';

export class EncounterPDFexport {
	static startExport = async function (encounter: Encounter, sourcebooks: Sourcebook[]) {
		const pdfAsBytes = await fetch(encounterSheet).then(res => res.arrayBuffer());
		const pdfDoc = await PDFDocument.load(pdfAsBytes);

		const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
		const fontSize = 9;

		const autoResizingFields: string[] = [];

		const sanitize = (str: string) => {
			// This replaces characters the PDF doesn't support
			return str
				.toString()
				.replace(/−/g, '-')
				.replace(/ź/g, 'z')
				.replace(/ń/g, 'n')
				.replace(/č/g, 'c');
		};

		const CleanupOutput = (text: string) => {
			text = text
				.replace(/(\|:-+)+\|\n/g, '')
				.replace(/\|\s+(.+?)\s+\| (.+?)\s+\|/g, '$1\t\t$2')
				.replace(/11 -\t/g, '11 or less')
				.replace(/17 \+/g, '17+\t')
				.replace(/\n\* \*\*(.*?)\*\*(:) /g, '\n   • $1$2\t')
				.replace(/\n\* /g, '\n   • ');
			// substitutions are for cleaning up lists to look better in the form
			return text;
		};

		const form = pdfDoc.getForm();
		for (const field of form.getFields()) {
			if (field instanceof PDFTextField) {
				field.disableRichFormatting();
				field.setFontSize(10);
			}
		}

		encounter.groups.filter(g => g.slots.length > 0).map((group, n) => {

			let names = '';
			let stamina = '';
			let ev = 0;
			group.slots.forEach(slot => {
				const monster = SourcebookLogic.getMonster(sourcebooks, slot.monsterID);
				if (!monster) {
					return null;
				}

				for (let i = 0; i < slot.count; ++i) {
					if (names != '')
						names += '\n';
					names += monster.name;

					if (stamina != '')
						stamina += '\n';

					stamina += monster.stamina;

					ev += monster.encounterValue;

					if (monster.role.organization === MonsterOrganizationType.Minion) {
						for (let i = 1; i < 4; ++i) {
							stamina += `/${monster.stamina * (i + 1)}`;
						}
					}
				}
			});

			(form.getField(`Roster#${n + 1} Group`) as PDFTextField).setText((n + 1).toString());
			(form.getField(`Roster#${n + 1} Creatures`) as PDFTextField).setText(names);
			(form.getField(`Roster#${n + 1} Stamina Tracker`) as PDFTextField).setText(stamina);
			(form.getField(`Roster#${n + 1} EV`) as PDFTextField).setText(ev.toString());
		});

		//form.getFields().forEach(f => console.log(f.getName()));

		const data = await pdfDoc.save();
		const part = [ data ] as BlobPart[];
		const url = window.URL.createObjectURL(new Blob(part, { type: 'application/pdf' }));

		const downloader = document.createElement('a');
		downloader.download = `${CleanupOutput(encounter.name || 'Unnamed Encounter')}.pdf`;
		downloader.href = url;
		downloader.click();

		window.URL.revokeObjectURL(url);
	};
}