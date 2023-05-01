from django.shortcuts import render


def vue(request):
    context = {
        "django_message": "Hello from Django!",
        "vue_message": "This message has been passed to a Vue component from a Django view.",
        "initial_value": 1000,
    }
    return render(request, "vue.html", context)
