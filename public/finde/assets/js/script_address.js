$(function () {
    var provinceObject = $("#province");
    var amphureObject = $("#amphure");
    var districtObject = $("#district");

    // var hoscodeObject = $("#hoscode");
    // on change province

    provinceObject.on("change", function () {

        var changwatCode = $(this).val();
        amphureObject.html('<option value="">เน€เธฅเธทเธญเธเธญเธณเน€เธ เธญ</option>');
        districtObject.html('<option value="">เน€เธฅเธทเธญเธเธ•เธณเธเธฅ</option>');
        // hoscodeObject.html('<option value="">เน€เธฅเธทเธญเธเธฃเธ.เธชเธ•.</option>');

        $.get("_get_amphure.php?changwatcode=" + changwatCode, function (data) {
            var result = JSON.parse(data);
            $.each(result, function (index, item) {
                amphureObject.append(
                    $("<option></option>").val(item.ampurcodefull).html(item.ampurname)
                );
            });
        });
    });

    // on change amphure
    amphureObject.on("change", function () {
        var ampurCode = $(this).val();
        districtObject.html('<option value="">เน€เธฅเธทเธญเธเธ•เธณเธเธฅ</option>');
        $.get("_get_district.php?ampurcodefull=" + ampurCode, function (data) {
            var result = JSON.parse(data);
            $.each(result, function (index, item) {
                districtObject.append(
                    $("<option></option>").val(item.tamboncodefull).html(item.tambonname)
                );
            });
        });
    });

});