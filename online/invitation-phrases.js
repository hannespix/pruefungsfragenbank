// Public vocabulary: security comes from five independent cryptographic bytes,
// never from keeping these words secret. Exactly 256 unique words => 40 bits.
export const invitationWords=Object.freeze(`
adler ahorn ampel amsel anker apfel aster atlas auto bach bagger balkon ball bambus banane bank
barsch bart basar bauch baum becher beet berg besen bett biene bild birke birne blatt blitz
block blume boden bohne boot borke bote brett brief brille brot brunnen buch bucht bude busch
dach dachs dampf dank datum decke deich delfin dinkel docht dorf dose drachen draht drossel duft
ecke efeu eiche eimer eis eisberg elch elster ente erbse erde esche esel eule falke farbe
farn fasan fass faust feder feige feld fels fenster ferien ferse feuer fichte finger fisch flocke
flosse flug fluss form frosch frost frucht fuchs funk gabel gans garten gasse gebiss geige geist
gelb geld gips gipfel glas glocke gold gras grau grube gurke gurt hafen hafer hahn hai
haken hals hammer hand hase haus hecht hecke heft heide helm hemd henne herbst herd herz
heu himmel hirsch holz honig horn hose hotel huf hummel hund hut igel iltis ingwer insel
jacke jaguar jahr jasmin judo juli juni kabel kakao kalb kalk kamel kamm kanne kanu karotte
karpfen karte katze kegel keks kelch keller kerze kies kiefer kirsche kissen klang klee kleid knopf
koffer kohl korb korn kran krebs kreide kreis krone krug kugel kunst kupfer lachs laden lager
lampe land laub lauch leben lehm leine lerche licht linde linse lippe liste lotse luchs luft
lupe mais makel maler mantel markt maske mast maus mehl meise melone messe milch minze mond
moos nadel nagel nebel nelke nest netz nuss oase obst ofen ohr olive otter palme panda
`.trim().split(/\s+/));
if(invitationWords.length!==256||new Set(invitationWords).size!==256||invitationWords.some(w=>!(/^[a-z]{3,8}$/).test(w)))throw Error('Invalid invitation vocabulary');

export function createInvitationPhrase(){
 return Array.from(crypto.getRandomValues(new Uint8Array(5)),byte=>invitationWords[byte]).join('-');
}

// Bound raw input before normalization. Accept spaces or hyphens, including
// common typographic dashes copied from printed invitations; reject invisibles.
export function normalizeInvitation(value){
 if(typeof value!=='string'||value.length>160)return null;
 const normalized=value.trim().toLowerCase();
 if(/^[a-f0-9]{64}$/.test(normalized))return normalized; // Existing links.
 const phrase=normalized.replace(/[\s\u2010-\u2015]+/g,'-').replace(/-+/g,'-');
 return /^[a-z]{3,8}(?:-[a-z]{3,8}){4}$/.test(phrase)?phrase:null;
}
