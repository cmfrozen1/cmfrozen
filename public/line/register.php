<?php

define('CLIENT_ID', 'kitTpfWW1P36sbedLG06tl');
define('LINE_API_URI', 'https://notify-bot.line.me/oauth/authorize?');
define('CALLBACK_URI', '/line/callback.php');

$queryStrings = [
    'response_type' => 'code',
    'client_id' => CLIENT_ID,
    'redirect_uri' => CALLBACK_URI,
    'scope' => 'notify',
    'state' => 'abcdef123456'
];

$queryString = LINE_API_URI . http_build_query($queryStrings);

?>

<a href="<?php echo $queryString; ?>">Register</a>